"""豆包图片编辑 LFX 组件 - 适配版"""

from __future__ import annotations

import os
import base64
import requests
from typing import Any

from dotenv import load_dotenv
from volcenginesdkarkruntime import Ark

# LFX系统导入
from lfx.custom.custom_component.component import Component
from lfx.schema.data import Data
from lfx.inputs.inputs import (
    BoolInput,
    SecretStrInput,
    MultilineInput,
    DropdownInput
)
from lfx.template.field.base import Output

load_dotenv()


class DoubaoImageEditor(Component):
    """调用豆包图片编辑接口的 LFX 组件，支持图片编辑和预览功能。"""

    display_name = "豆包图片编辑"
    description = "调用豆包图片编辑接口，支持根据提示词编辑图片，可自定义模型、提示词、图片等参数。"
    icon = "DoubaoImageEditor"
    name = "DoubaoImageEditor"

    # 模型配置映射：UI显示名称 -> API端点ID
    MODEL_MAPPING = {
        "Doubao-SeedEdit-3.0-i2i": "ep-20251104225339-b2jqg",
        "Doubao-SeedEdit-3.0-i2i｜250628": "ep-20251104225339-b2jqg",
    }

    inputs = [
        DropdownInput(
            name="model_name",
            display_name="模型名称",
            options=[
                "Doubao-SeedEdit-3.0-i2i｜250628"
            ],
            required=True,
            value="Doubao-SeedEdit-3.0-i2i｜250628",  # 使用UI显示的模型名称作为默认值
            info="选择豆包图片编辑模型，UI显示模型名称，API调用使用对应的端点ID。",
        ),
        MultilineInput(
            name="prompt",
            display_name="图片编辑提示词",
            required=True,
            value="",
            placeholder="示例：改成爱心形状的泡泡",
            info="描述要对图片进行的编辑操作，支持详细的编辑描述。",
            input_types=["Message", "Data", "Text"],
        ),
        MultilineInput(
            name="image_url",
            display_name="原图片URL",
            required=True,
            value="",
            placeholder="输入要编辑的图片URL，支持http/https链接",
            info="提供需要编辑的原始图片URL地址。",
            input_types=["Message", "Data", "Text"],
        ),
        BoolInput(
            name="watermark",
            display_name="添加水印",
            value=False,
            required=False,
            show=False,
            info="是否在编辑后的图片中添加水印。",
        ),
        BoolInput(
            name="enable_preview",
            display_name="启用预览",
            value=True,
            required=False,
            show=False,
            info="是否在结果中包含base64编码的图片预览。",
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
            display_name="编辑结果",
            method="edit_image",
            types=["Data"],
        )
    ]

    def edit_image(self) -> Data:
        merged_prompt = self._merge_prompt(self.prompt)
        if not merged_prompt:
            return self._error("提示词不能为空，请输入或连接提示词。")

        image_url = self._extract_image_url(self.image_url)
        if not image_url:
            return self._error("图片URL不能为空，请输入图片URL或连接上游图片节点。")

        api_key = (self.api_key or os.getenv("ARK_API_KEY", "")).strip()
        if not api_key:
            return self._error("未检测到豆包 API 密钥，请在节点或 .env 中配置 ARK_API_KEY。")

        # 初始化Ark客户端
        client = Ark(
            base_url="https://ark.cn-beijing.volces.com/api/v3",
            api_key=api_key,
        )

        # 准备API参数
        try:
            # 使用固定的默认值
            guidance_scale = 5.5  # 固定默认引导强度
            seed = 123  # 固定默认随机种子
            size = "adaptive"  # 固定使用adaptive尺寸
            watermark = bool(self.watermark)
            enable_preview = bool(self.enable_preview)

            # 获取API调用所需的端点ID
            endpoint_id = self.MODEL_MAPPING.get(self.model_name, self.model_name)
        except (TypeError, ValueError):
            return self._error("参数格式错误，请检查输入的数值。")

        # 构建编辑参数
        edit_params = {
            "model": endpoint_id,  # 使用端点ID进行API调用
            "prompt": merged_prompt,
            "image": image_url,
            "guidance_scale": guidance_scale,
            "seed": seed,  # 固定包含seed参数
            "size": size,
            "watermark": watermark,
        }

        try:
            self.status = "🎨 开始图片编辑..."

            # 调用豆包图片编辑API
            response = client.images.generate(**edit_params)

            # 检查响应结构
            if not hasattr(response, 'data') or not response.data:
                return self._error("API响应格式错误：未找到编辑结果数据。")

            # 获取编辑后的图片URL
            if len(response.data) == 0 or not hasattr(response.data[0], 'url'):
                return self._error("API响应格式错误：未找到图片URL。")

            edited_image_url = response.data[0].url

            # 构建基础结果数据
            result_data = {
                "edited_image_url": edited_image_url,
                "original_image_url": image_url,
                "prompt": merged_prompt,
                "model_display_name": self.model_name,  # UI显示的模型名称
                "model_endpoint_id": endpoint_id,  # API调用使用的端点ID
                "guidance_scale": guidance_scale,
                "size": size,
                "watermark": watermark,
                "seed": seed,
                "preview_enabled": enable_preview,
            }

            # 添加可选的预览图片
            if enable_preview:
                self.status = "🖼️ 生成图片预览..."
                preview_base64 = self._get_image_preview(edited_image_url)
                if preview_base64:
                    result_data["preview_base64"] = preview_base64
                    result_data["preview_type"] = "image/jpeg"
                else:
                    result_data["preview_error"] = "预览生成失败，但编辑成功"

            self.status = f"✅ 图片编辑成功 ({size})"

            return Data(data=result_data, type="image")

        except Exception as exc:
            return self._error(f"图片编辑失败：{exc}")

    def _get_image_preview(self, image_url: str) -> str | None:
        """获取图片的base64预览"""
        try:
            response = requests.get(
                image_url,
                timeout=10,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            )
            response.raise_for_status()

            # 限制图片大小，避免base64过大
            max_size = 5 * 1024 * 1024  # 5MB
            if len(response.content) > max_size:
                return None

            base64_data = base64.b64encode(response.content).decode('utf-8')
            return f"data:image/jpeg;base64,{base64_data}"

        except Exception:
            return None

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

    def _extract_image_url(self, image_url_input: str | None) -> str | None:
        """从多个输入源提取图片URL"""
        # 优先使用直接输入的URL
        if image_url_input:
            url = image_url_input.strip()
            if url.startswith(('http://', 'https://')):
                return url

        # 尝试从上传输入提取URL
        try:
            return self._extract_image_url_from_input(image_url_input)
        except Exception:
            pass

        return None

    def _extract_image_url_from_input(self, image_input: Any) -> str | None:
        """从输入中提取图片URL"""
        try:
            # LFX系统的数据处理
            if hasattr(image_input, 'get_text'):
                text = image_input.get_text()
            elif hasattr(image_input, 'text'):
                text = image_input.text
            elif hasattr(image_input, 'data') and isinstance(image_input.data, dict):
                # 检查Data中是否有图片相关字段
                for field in ['image_url', 'url', 'image', 'edited_image_url', 'video_url']:
                    if field in image_input.data and image_input.data[field]:
                        url_str = str(image_input.data[field])
                        if url_str.startswith(('http://', 'https://')):
                            return url_str
                text = str(image_input.data)
            else:
                text = str(image_input)

            # 简单的URL检测
            text = text.strip()
            if text.startswith(('http://', 'https://')):
                return text

        except Exception:
            pass

        return None

    @staticmethod
    def _error(message: str) -> Data:
        return Data(data={"error": message}, type="error")


if __name__ == "__main__":
    print("DoubaoImageEditor component loaded successfully for LFX system")