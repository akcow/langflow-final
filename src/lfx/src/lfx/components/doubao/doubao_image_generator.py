"""豆包文生图 LFX 组件 - 适配版"""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from volcenginesdkarkruntime import Ark

# LFX系统导入
from lfx.custom.custom_component.component import Component
from lfx.schema.data import Data
from lfx.inputs.inputs import (
    BoolInput,
    DropdownInput,
    IntInput,
    SecretStrInput,
    MultilineInput,
)
from lfx.template.field.base import Output

load_dotenv()


class DoubaoImageGenerator(Component):
    """调用豆包图片生成接口的 LFX 组件。"""

    display_name = "豆包文生图"
    description = "调用豆包图片生成接口，可自定义模型、提示词与尺寸。"
    icon = "DoubaoImageGenerator"
    name = "DoubaoImageGenerator"

    # 模型配置映射：UI显示名称 -> API端点ID
    MODEL_MAPPING = {
        "Doubao-Seedream-3.0-t2i｜250415": "ep-20250908160620-bblrc",
    }

    inputs = [
        DropdownInput(
            name="model_name",
            display_name="模型名称",
            options=[
                "Doubao-Seedream-3.0-t2i｜250415"
            ],
            value="Doubao-Seedream-3.0-t2i｜250415",  # 使用UI显示的模型名称作为默认值
            required=True,
            info="选择豆包文生图模型，UI显示模型名称，API调用使用对应的端点ID。",
        ),
        MultilineInput(
            name="prompt",
            display_name="生成提示词",
            required=False,
            value="",
            placeholder="示例：一只坐在月亮上的兔子，童话插画风格",
            info="可直接在此输入提示词，也可连接 Prompt / LLM 等上游节点以复用生成内容。",
            input_types=["Message", "Data", "Text"],
        ),
        IntInput(
            name="width",
            display_name="图片宽度",
            required=False,
            value=512,
            info="生成图片的宽度（像素）。建议使用 512 的倍数。",
        ),
        IntInput(
            name="height",
            display_name="图片高度",
            required=False,
            value=512,
            info="生成图片的高度（像素）。建议使用 512 的倍数。",
        ),
        DropdownInput(
            name="watermark",
            display_name="是否添加水印",
            options=["true", "false"],
            value="false",
            required=False,
            show=False,
            info="是否在生成的图片中添加水印。",
        ),
        BoolInput(
            name="enable_preview",
            display_name="启用实时预览",
            value=True,
            required=False,
            show=False,
            info="是否下载并预览生成的图片，启用后会显示图片缩略图。",
        ),
        SecretStrInput(
            name="api_key",
            display_name="豆包 API 密钥",
            required=False,
            value=os.getenv("ARK_API_KEY", ""),
            placeholder="如留空将读取 .env 中的 ARK_API_KEY",
            info="用于访问豆包 API 的密钥，可在节点中覆盖默认值。",
        ),
    ]

    outputs = [
        Output(
            name="image",
            display_name="图片结果",
            method="build_image",
            types=["Data"],
        )
    ]

    def build_image(self) -> Data:
        merged_prompt = self._merge_prompt(self.prompt)
        if not merged_prompt:
            return self._error("提示词不能为空，请输入或连接提示词。")

        api_key = (self.api_key or os.getenv("ARK_API_KEY", "")).strip()
        if not api_key:
            return self._error("未检测到豆包 API 密钥，请在节点或 .env 中配置 ARK_API_KEY。")

        # 初始化Ark客户端（按照官方示例方式）
        client = Ark(
            # 此为默认路径，您可根据业务所在地域进行配置
            base_url="https://ark.cn-beijing.volces.com/api/v3",
            # 从环境变量中获取您的 API Key。此为默认方式，您可根据需要进行修改
            api_key=api_key,
        )

        # 准备API参数
        try:
            width = int(self.width or 512)
            height = int(self.height or 512)
            # 使用默认的引导强度
            guidance_scale = 2.5  # 默认引导强度
            watermark = self.watermark == "true"
            enable_preview = bool(self.enable_preview)

            # 获取API调用所需的端点ID
            endpoint_id = self.MODEL_MAPPING.get(self.model_name, self.model_name)
        except (TypeError, ValueError):
            return self._error("参数格式错误，请检查输入的数值。")

        # 构建参数字典
        generate_params = {
            "model": endpoint_id,  # 使用端点ID进行API调用
            "prompt": merged_prompt,
            "size": f"{width}x{height}",
            "guidance_scale": guidance_scale,
            "watermark": watermark,
        }

        try:
            # 使用官方SDK调用豆包图像生成模型
            images_response = client.images.generate(**generate_params)

            # 从响应中提取图片URL
            if images_response.data and len(images_response.data) > 0:
                image_url = images_response.data[0].url
                if not image_url:
                    return self._error("接口返回的数据中没有图片地址，请检查提示词或模型配置。")
            else:
                return self._error("接口返回的数据格式异常。")

        except Exception as exc:
            # 详细分析错误类型并提供针对性建议
            error_msg = str(exc)

            if "Error code: 403" in error_msg or "AccessDenied" in error_msg:
                return self._error(
                    "权限不足 (403 Forbidden)\n"
                    "可能原因：\n"
                    "1. API密钥没有图像生成权限\n"
                    "2. 账户余额不足或配额用完\n"
                    "3. 需要在豆包控制台开通图像生成服务\n"
                    f"技术详情：{error_msg}"
                )
            elif "Error code: 401" in error_msg or "Unauthorized" in error_msg:
                return self._error(
                    "认证失败 (401 Unauthorized)\n"
                    "可能原因：\n"
                    "1. API密钥格式错误或已过期\n"
                    "2. 环境变量ARK_API_KEY未正确设置\n"
                    f"技术详情：{error_msg}"
                )
            elif "Error code: 404" in error_msg or "NotFound" in error_msg:
                return self._error(
                    "资源不存在 (404 Not Found)\n"
                    "可能原因：\n"
                    "1. 模型ID不存在或已下线\n"
                    "2. API端点地址错误\n"
                    f"技术详情：{error_msg}"
                )
            elif "Error code: 429" in error_msg or "RateLimit" in error_msg:
                return self._error(
                    "请求频率超限 (429 Too Many Requests)\n"
                    "可能原因：\n"
                    "1. 调用频率超过限制\n"
                    "2. 请稍后重试\n"
                    f"技术详情：{error_msg}"
                )
            elif "timeout" in error_msg.lower():
                return self._error(
                    "请求超时\n"
                    "可能原因：\n"
                    "1. 网络连接不稳定\n"
                    "2. 服务器响应缓慢\n"
                    "3. 图片生成任务过重\n"
                    f"技术详情：{error_msg}"
                )
            else:
                return self._error(
                    f"图片生成失败\n"
                    f"错误类型：{type(exc).__name__}\n"
                    f"技术详情：{error_msg}\n"
                    f"建议：请检查网络连接、API密钥权限和模型配置"
                )

        # 构建基础返回数据
        result_data = {
            "image_url": image_url,
            "prompt": merged_prompt,
            "width": width,
            "height": height,
            "guidance_scale": guidance_scale,
            "seed": "随机",  # 显示为随机种子
            "watermark": watermark,
            "model_display_name": self.model_name,  # UI显示的模型名称
            "model_endpoint_id": endpoint_id,  # API调用使用的端点ID
            "preview_enabled": enable_preview,
        }

        # 图片预览处理
        if enable_preview:
            try:
                import base64
                import requests

                # 下载图片
                response = requests.get(image_url, timeout=15)
                response.raise_for_status()

                # 将图片转换为base64
                image_data = response.content
                base64_data = base64.b64encode(image_data).decode('utf-8')

                # 检测图片格式
                if image_url.lower().endswith('.png'):
                    data_url = f"data:image/png;base64,{base64_data}"
                elif image_url.lower().endswith(('.jpg', '.jpeg')):
                    data_url = f"data:image/jpeg;base64,{base64_data}"
                else:
                    # 默认使用jpeg格式
                    data_url = f"data:image/jpeg;base64,{base64_data}"

                result_data.update({
                    "image_data_url": data_url,
                    "preview_available": True,
                    "preview_size": len(image_data),
                })

                self.status = f"[成功] 图片生成成功 ({width}×{height}px) - 预览已加载"

            except requests.exceptions.RequestException as e:
                self.status = f"[警告] 图片生成成功，但预览下载失败：{str(e)}"
                result_data["preview_error"] = f"下载失败: {str(e)}"
            except Exception as e:
                self.status = f"[警告] 图片生成成功，但预览处理失败：{str(e)}"
                result_data["preview_error"] = f"处理失败: {str(e)}"
        else:
            self.status = f"[成功] 图片生成成功 ({width}×{height}px) - 预览已禁用"

        return Data(data=result_data, type="image")

    @staticmethod
    def _extract_image_url(result: dict[str, Any]) -> str | None:
        data_list = result.get("data") if isinstance(result, dict) else None
        if isinstance(data_list, list) and data_list:
            first_item = data_list[0] or {}
            url = first_item.get("url")
            if isinstance(url, str) and url.strip():
                return url.strip()
        return None

    @staticmethod
    def _error(message: str) -> Data:
        return Data(data={"error": message}, type="error")

    def _merge_prompt(self, prompt_source: Any | None) -> str:
        parts: list[str] = []

        def _append_value(value: Any | None) -> None:
            if value is None:
                return
            if isinstance(value, (list, tuple, set)):
                for item in value:
                    _append_value(item)
                return
            try:
                if hasattr(value, "get_text"):
                    text_value = value.get_text()
                elif hasattr(value, "text"):
                    text_value = value.text
                else:
                    text_value = value
            except Exception:
                text_value = value

            if isinstance(text_value, bytes):
                text_value = text_value.decode("utf-8", errors="ignore")

            text_str = str(text_value or "").strip()
            if text_str:
                parts.append(text_str)

        _append_value(prompt_source)

        return "\n".join(parts).strip()


if __name__ == "__main__":
    print("DoubaoImageGenerator component loaded successfully for LFX system")