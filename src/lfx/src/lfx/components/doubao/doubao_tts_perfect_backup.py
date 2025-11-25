"""豆包语音合成 LangFlow 组件 - 完整版 v3"""

from __future__ import annotations

import asyncio
import base64
import copy
import io
import json
import os
import struct
import uuid
from dataclasses import dataclass
from enum import IntEnum
from typing import Any

from dotenv import load_dotenv

from langflow.custom import Component
from langflow.helpers.data import safe_convert
from langflow.inputs.inputs import (
    BoolInput,
    DropdownInput,
    HandleInput,
    MessageTextInput,
    MultilineInput,
    SecretStrInput,
)
from langflow.schema import Data
from langflow.schema.message import Message as FlowMessage
from langflow.template.field.base import Output

load_dotenv()


class MsgType(IntEnum):
    """Message type enumeration."""

    Invalid = 0
    FullClientRequest = 0b1
    AudioOnlyClient = 0b10
    FullServerResponse = 0b1001
    AudioOnlyServer = 0b1011
    FrontEndResultServer = 0b1100
    Error = 0b1111

    ServerACK = AudioOnlyServer

    def __str__(self) -> str:
        return self.name if self.name else f"MsgType({self.value})"


class MsgTypeFlagBits(IntEnum):
    """Message type flag bits."""

    NoSeq = 0
    PositiveSeq = 0b1
    LastNoSeq = 0b10
    NegativeSeq = 0b11
    WithEvent = 0b100


class VersionBits(IntEnum):
    """Version bits."""

    Version1 = 1
    Version2 = 2
    Version3 = 3
    Version4 = 4


class HeaderSizeBits(IntEnum):
    """Header size bits."""

    HeaderSize4 = 1
    HeaderSize8 = 2
    HeaderSize12 = 3
    HeaderSize16 = 4


class SerializationBits(IntEnum):
    """Serialization method bits."""

    Raw = 0
    JSON = 0b1
    Thrift = 0b11
    Custom = 0b1111


class CompressionBits(IntEnum):
    """Compression method bits."""

    None_ = 0
    Gzip = 0b1
    Custom = 0b1111


class EventType(IntEnum):
    """Message type enumeration."""

    None_ = 0
    StartConnection = 1
    StartTask = 1
    FinishConnection = 2
    FinishTask = 2

    ConnectionStarted = 50
    TaskStarted = 50
    ConnectionFailed = 51
    TaskFailed = 51
    ConnectionFinished = 52
    TaskFinished = 52

    StartSession = 100
    CancelSession = 101
    FinishSession = 102

    SessionStarted = 150
    SessionCanceled = 151
    SessionFinished = 152
    SessionFailed = 153
    UsageResponse = 154
    ChargeData = 154

    TaskRequest = 200
    UpdateConfig = 201

    AudioMuted = 250

    SayHello = 300

    TTSSentenceStart = 350
    TTSSentenceEnd = 351
    TTSResponse = 352
    TTSEnded = 359
    PodcastRoundStart = 360
    PodcastRoundResponse = 361
    PodcastRoundEnd = 362

    ASRInfo = 450
    ASRResponse = 451
    ASREnded = 459

    ChatTTSText = 500

    ChatResponse = 550
    ChatEnded = 559

    SourceSubtitleStart = 650
    SourceSubtitleResponse = 651
    SourceSubtitleEnd = 652
    TranslationSubtitleStart = 653
    TranslationSubtitleResponse = 654
    TranslationSubtitleEnd = 655

    def __str__(self) -> str:
        return self.name if self.name else f"EventType({self.value})"


@dataclass
class ProtocolMessage:
    """Bidirectional TTS protocol message."""

    version: VersionBits = VersionBits.Version1
    header_size: HeaderSizeBits = HeaderSizeBits.HeaderSize4
    type: MsgType = MsgType.Invalid
    flag: MsgTypeFlagBits = MsgTypeFlagBits.NoSeq
    serialization: SerializationBits = SerializationBits.JSON
    compression: CompressionBits = CompressionBits.None_
    event: EventType = EventType.None_
    session_id: str = ""
    connect_id: str = ""
    sequence: int = 0
    error_code: int = 0
    payload: bytes = b""

    @classmethod
    def from_bytes(cls, data: bytes):
        if len(data) < 3:
            raise ValueError(f"Data too short: expected at least 3 bytes, got {len(data)}")

        version_and_size = data[0]
        version = VersionBits(version_and_size >> 4)
        header_size = HeaderSizeBits(version_and_size & 0b00001111)

        type_and_flag = data[1]
        msg_type = MsgType(type_and_flag >> 4)
        flag = MsgTypeFlagBits(type_and_flag & 0b00001111)

        message = cls(type=msg_type, flag=flag)
        message.unmarshal(data)
        return message

    def marshal(self) -> bytes:
        buffer = io.BytesIO()

        header = [
            (self.version << 4) | self.header_size,
            (self.type << 4) | self.flag,
            (self.serialization << 4) | self.compression,
        ]

        header_size_bytes = 4 * self.header_size
        if padding := header_size_bytes - len(header):
            header.extend([0] * padding)

        buffer.write(bytes(header))

        for writer in self._get_writers():
            writer(buffer)

        return buffer.getvalue()

    def unmarshal(self, data: bytes) -> None:
        buffer = io.BytesIO(data)

        version_and_header_size = buffer.read(1)[0]
        self.version = VersionBits(version_and_header_size >> 4)
        self.header_size = HeaderSizeBits(version_and_header_size & 0b00001111)

        buffer.read(1)

        serialization_compression = buffer.read(1)[0]
        self.serialization = SerializationBits(serialization_compression >> 4)
        self.compression = CompressionBits(serialization_compression & 0b00001111)

        header_size_bytes = 4 * self.header_size
        read_size = 3
        if padding := header_size_bytes - read_size:
            buffer.read(padding)

        for reader in self._get_readers():
            reader(buffer)

        remaining = buffer.read()
        if remaining:
            raise ValueError(f"Unexpected trailing data: {remaining!r}")

    def _get_writers(self):
        writers = []

        if self.flag == MsgTypeFlagBits.WithEvent:
            writers.extend([self._write_event, self._write_session_id])

        if self.type in (
            MsgType.FullClientRequest,
            MsgType.FullServerResponse,
            MsgType.FrontEndResultServer,
            MsgType.AudioOnlyClient,
            MsgType.AudioOnlyServer,
        ):
            if self.flag in (MsgTypeFlagBits.PositiveSeq, MsgTypeFlagBits.NegativeSeq):
                writers.append(self._write_sequence)
        elif self.type == MsgType.Error:
            writers.append(self._write_error_code)
        else:
            raise ValueError(f"Unsupported message type: {self.type}")

        writers.append(self._write_payload)
        return writers

    def _get_readers(self):
        readers = []

        if self.type in (
            MsgType.FullClientRequest,
            MsgType.FullServerResponse,
            MsgType.FrontEndResultServer,
            MsgType.AudioOnlyClient,
            MsgType.AudioOnlyServer,
        ):
            if self.flag in (MsgTypeFlagBits.PositiveSeq, MsgTypeFlagBits.NegativeSeq):
                readers.append(self._read_sequence)
        elif self.type == MsgType.Error:
            readers.append(self._read_error_code)
        else:
            raise ValueError(f"Unsupported message type: {self.type}")

        if self.flag == MsgTypeFlagBits.WithEvent:
            readers.extend([self._read_event, self._read_session_id, self._read_connect_id])

        readers.append(self._read_payload)
        return readers

    def _write_event(self, buffer: io.BytesIO) -> None:
        buffer.write(struct.pack(">i", self.event))

    def _write_session_id(self, buffer: io.BytesIO) -> None:
        if self.event in (
            EventType.StartConnection,
            EventType.FinishConnection,
            EventType.ConnectionStarted,
            EventType.ConnectionFailed,
            EventType.ConnectionFinished,
        ):
            return

        session_id_bytes = self.session_id.encode("utf-8")
        size = len(session_id_bytes)
        if size > 0xFFFFFFFF:
            raise ValueError(f"Session ID too long: {size} bytes")

        buffer.write(struct.pack(">I", size))
        if size > 0:
            buffer.write(session_id_bytes)

    def _write_sequence(self, buffer: io.BytesIO) -> None:
        buffer.write(struct.pack(">i", self.sequence))

    def _write_error_code(self, buffer: io.BytesIO) -> None:
        buffer.write(struct.pack(">I", self.error_code))

    def _write_payload(self, buffer: io.BytesIO) -> None:
        size = len(self.payload)
        if size > 0xFFFFFFFF:
            raise ValueError(f"Payload too large: {size} bytes")
        buffer.write(struct.pack(">I", size))
        buffer.write(self.payload)

    def _read_event(self, buffer: io.BytesIO) -> None:
        event_bytes = buffer.read(4)
        if event_bytes:
            self.event = EventType(struct.unpack(">i", event_bytes)[0])

    def _read_session_id(self, buffer: io.BytesIO) -> None:
        if self.event in (
            EventType.StartConnection,
            EventType.FinishConnection,
            EventType.ConnectionStarted,
            EventType.ConnectionFailed,
            EventType.ConnectionFinished,
        ):
            return

        size_bytes = buffer.read(4)
        if size_bytes:
            size = struct.unpack(">I", size_bytes)[0]
            if size:
                session_bytes = buffer.read(size)
                if len(session_bytes) == size:
                    self.session_id = session_bytes.decode("utf-8")

    def _read_connect_id(self, buffer: io.BytesIO) -> None:
        if self.event in (
            EventType.ConnectionStarted,
            EventType.ConnectionFailed,
            EventType.ConnectionFinished,
        ):
            size_bytes = buffer.read(4)
            if size_bytes:
                size = struct.unpack(">I", size_bytes)[0]
                if size:
                    self.connect_id = buffer.read(size).decode("utf-8")

    def _read_sequence(self, buffer: io.BytesIO) -> None:
        sequence_bytes = buffer.read(4)
        if sequence_bytes:
            self.sequence = struct.unpack(">i", sequence_bytes)[0]

    def _read_error_code(self, buffer: io.BytesIO) -> None:
        error_bytes = buffer.read(4)
        if error_bytes:
            self.error_code = struct.unpack(">I", error_bytes)[0]

    def _read_payload(self, buffer: io.BytesIO) -> None:
        size_bytes = buffer.read(4)
        if size_bytes:
            size = struct.unpack(">I", size_bytes)[0]
            if size:
                self.payload = buffer.read(size)

    def __str__(self) -> str:
        if self.type in (MsgType.AudioOnlyServer, MsgType.AudioOnlyClient):
            if self.flag in (MsgTypeFlagBits.PositiveSeq, MsgTypeFlagBits.NegativeSeq):
                return (
                    f"MsgType: {self.type}, EventType: {self.event}, "
                    f"Sequence: {self.sequence}, PayloadSize: {len(self.payload)}"
                )
            return f"MsgType: {self.type}, EventType: {self.event}, PayloadSize: {len(self.payload)}"
        if self.type == MsgType.Error:
            return (
                f"MsgType: {self.type}, EventType: {self.event}, "
                f"ErrorCode: {self.error_code}, Payload: {self.payload.decode('utf-8', 'ignore')}"
            )
        if self.flag in (MsgTypeFlagBits.PositiveSeq, MsgTypeFlagBits.NegativeSeq):
            return (
                f"MsgType: {self.type}, EventType: {self.event}, "
                f"Sequence: {self.sequence}, Payload: {self.payload.decode('utf-8', 'ignore')}"
            )
        return f"MsgType: {self.type}, EventType: {self.event}, Payload: {self.payload.decode('utf-8', 'ignore')}"


async def protocol_receive_message(websocket) -> ProtocolMessage:
    data = await websocket.recv()
    if isinstance(data, str):
        raise ValueError(f"Unexpected text frame: {data}")
    if not isinstance(data, (bytes, bytearray)):
        raise ValueError(f"Unexpected frame type: {type(data)}")
    message = ProtocolMessage.from_bytes(bytes(data))
    return message


async def protocol_wait_for_event(websocket, msg_type: MsgType, event_type: EventType) -> ProtocolMessage:
    while True:
        message = await protocol_receive_message(websocket)

        if message.type == MsgType.Error:
            payload = message.payload.decode("utf-8", "ignore")
            raise RuntimeError(f"Server returned error {message.error_code}: {payload}")

        if message.type == msg_type and message.event == event_type:
            return message


async def protocol_start_connection(websocket) -> None:
    message = ProtocolMessage(type=MsgType.FullClientRequest, flag=MsgTypeFlagBits.WithEvent)
    message.event = EventType.StartConnection
    message.payload = b"{}"
    await websocket.send(message.marshal())


async def protocol_finish_connection(websocket) -> None:
    message = ProtocolMessage(type=MsgType.FullClientRequest, flag=MsgTypeFlagBits.WithEvent)
    message.event = EventType.FinishConnection
    message.payload = b"{}"
    await websocket.send(message.marshal())


async def protocol_start_session(websocket, payload: bytes, session_id: str) -> None:
    message = ProtocolMessage(type=MsgType.FullClientRequest, flag=MsgTypeFlagBits.WithEvent)
    message.event = EventType.StartSession
    message.session_id = session_id
    message.payload = payload
    await websocket.send(message.marshal())


async def protocol_finish_session(websocket, session_id: str) -> None:
    message = ProtocolMessage(type=MsgType.FullClientRequest, flag=MsgTypeFlagBits.WithEvent)
    message.event = EventType.FinishSession
    message.session_id = session_id
    message.payload = b"{}"
    await websocket.send(message.marshal())


async def protocol_task_request(websocket, payload: bytes, session_id: str) -> None:
    message = ProtocolMessage(type=MsgType.FullClientRequest, flag=MsgTypeFlagBits.WithEvent)
    message.event = EventType.TaskRequest
    message.session_id = session_id
    message.payload = payload
    await websocket.send(message.marshal())


class DoubaoTTS(Component):
    """豆包语音合成 LangFlow 组件 - 完整版 v3 双向流式"""

    display_name = "豆包语音合成 v3"
    description = "调用豆包语音合成v3双向流式接口，将文本转换为语音。"
    icon = "volume-2"
    name = "DoubaoTTS"

    # 音色配置映射：UI显示名称 -> voice_type
    VOICE_MAPPING = {
        "vivi (通用场景，可配英语)": "zh_female_vv_uranus_bigtts",
        "大壹 (视频配音-男声)": "zh_male_dayi_saturn_bigtts",
        "黑猫侦探社咪仔 (视频配音-女声)": "zh_female_mizai_saturn_bigtts",
        "鸡汤女 (视频配音-女声)": "zh_female_jitangnv_saturn_bigtts",
        "魅力女友 (视频配音-女声)": "zh_female_meilinvyou_saturn_bigtts",
        "流畅女声 (视频配音-女声)": "zh_female_santongyongns_saturn_bigtts",
        "儒雅逸辰 (视频配音-男声)": "zh_male_ruyayichen_saturn_bigtts",
        "可爱女生 (角色扮演-女声)": "saturn_zh_female_keainvsheng_tob",
        "调皮公主 (角色扮演-女声)": "saturn_zh_female_tiaopigongzhu_tob",
        "爽朗少年 (角色扮演-男声)": "saturn_zh_male_shuanglangshaonian_tob",
        "天才同桌 (角色扮演-男声)": "saturn_zh_male_tiancaitongzhuo_tob",
        "知性灿灿 (角色扮演-女声)": "saturn_zh_female_cancan_tob",
    }

    inputs = [
        DropdownInput(
            name="voice_type",
            display_name="音色类型",
            options=[
                "vivi (通用场景，可配英语)",
                "大壹 (视频配音-男声)",
                "黑猫侦探社咪仔 (视频配音-女声)",
                "鸡汤女 (视频配音-女声)",
                "魅力女友 (视频配音-女声)",
                "流畅女声 (视频配音-女声)",
                "儒雅逸辰 (视频配音-男声)",
                "可爱女生 (角色扮演-女声)",
                "调皮公主 (角色扮演-女声)",
                "爽朗少年 (角色扮演-男声)",
                "天才同桌 (角色扮演-男声)",
                "知性灿灿 (角色扮演-女声)",
            ],
            value="vivi (通用场景，可配英语)",
            required=True,
            info="选择音色类型，包含通用场景、视频配音、角色扮演等多种风格，支持中英文合成。",
        ),
        MultilineInput(
            name="text",
            display_name="合成文本",
            required=True,
            value="",
            placeholder="请输入需要转换为语音的文本...",
            info="需要合成的文本内容，支持中英文等多语种。",
        ),
        SecretStrInput(
            name="app_id",
            display_name="App ID",
            required=False,
            value=os.getenv("TTS_APP_ID", ""),
            placeholder="火山引擎语音合成v3页面获取的纯数字App ID",
            info="用于 X-Api-App-Key 头部，必须是纯数字格式（如：4942118390）",
        ),
        SecretStrInput(
            name="access_token",
            display_name="Access Token",
            required=False,
            value=os.getenv("TTS_TOKEN", ""),
            placeholder="火山引擎语音合成v3页面获取的Access Token",
            info="用于 X-Api-Access-Key 头部，支持任意格式的Access Token",
        ),
        BoolInput(
            name="save_audio",
            display_name="保存音频文件",
            value=False,
            required=False,
            info="是否将生成的音频落地到本地文件。",
        ),
        MessageTextInput(
            name="filename",
            display_name="文件名前缀",
            required=False,
            value="output",
            placeholder="不包含扩展名，例如 doubao_tts_result",
            info="保存音频文件的名称，仅在启用保存时生效。",
        ),
        HandleInput(
            name="text_input",
            display_name="上游文本",
            input_types=["Message", "Data", "Text"],
            required=False,
            info="可连接 Prompt / LLM 等节点；与本节点文本同时填写时会自动拼接。",
        ),
    ]

    outputs = [
        Output(
            name="audio",
            display_name="语音合成结果",
            method="synthesize_speech",
            types=["Data"],
        )
    ]

    def synthesize_speech(self) -> Data:
        try:
            return asyncio.run(self._synthesize_speech_websocket())
        except Exception as exc:
            return self._error(f"WebSocket 语音合成失败：{exc}")

    async def _synthesize_speech_websocket(self) -> Data:
        import websockets

        merged_text = self._merge_text(self.text, getattr(self, "text_input", None))
        if not merged_text:
            return self._error("合成文本不能为空，请输入文本或连接上游文本节点。")

        app_id = (self.app_id or os.getenv("TTS_APP_ID", "")).strip()
        access_token = (self.access_token or os.getenv("TTS_TOKEN", "")).strip()

        # 基本格式验证
        if app_id and not app_id.isdigit():
            return self._error("App ID 格式错误，应为纯数字（如：4942118390），请检查火山引擎控制台获取的App ID")

        # 移除tok-开头的格式验证，支持任何格式的Access Token
        if access_token and not access_token.strip():
            return self._error("Access Token 不能为空，请检查火山引擎控制台获取的Access Token")

        missing_credentials = []
        if not app_id:
            missing_credentials.append("App ID")
        if not access_token:
            missing_credentials.append("Access Token")
        if missing_credentials:
            return self._error(f"以下 API 凭证缺失：{', '.join(missing_credentials)}，请在节点或 .env 中配置。")

        try:
            filename = (self.filename or "output").strip() or "output"
            save_audio = bool(self.save_audio)
        except (TypeError, ValueError) as exc:
            return self._error(f"参数格式错误：{exc}")

        # 使用默认参数
        encoding = "mp3"
        sample_rate = 24000
        audio_params = self._build_audio_params()
        additions = self._build_additions()

        # 获取API调用所需的实际voice_type
        actual_voice_type = self.VOICE_MAPPING.get(self.voice_type, self.voice_type)

        headers = {
            "X-Api-App-Key": app_id,
            "X-Api-Access-Key": access_token,
            "X-Api-Resource-Id": "volc.service_type.10029",
            "X-Api-Connect-Id": str(uuid.uuid4()),
        }
        endpoint = "wss://openspeech.bytedance.com/api/v3/tts/bidirection"

        self.status = "Connecting to Doubao TTS..."
        audio_bytes: bytearray | None = None

        try:
            async with websockets.connect(
                endpoint,
                additional_headers=headers,
                max_size=10 * 1024 * 1024,
            ) as websocket:
                await protocol_start_connection(websocket)
                connection_msg = await protocol_wait_for_event(
                    websocket, MsgType.FullServerResponse, EventType.ConnectionStarted
                )
                connect_id = connection_msg.connect_id or headers["X-Api-Connect-Id"]
                self.status = f"WebSocket connected (ID: {connect_id})"

                session_id = str(uuid.uuid4())

                session_meta = {
                    "user": {"uid": str(uuid.uuid4())},
                    "namespace": "BidirectionalTTS",
                    "req_params": {
                        "speaker": actual_voice_type,  # 使用实际的voice_type进行API调用
                        "audio_params": audio_params,
                        "additions": json.dumps(additions, ensure_ascii=False),
                    },
                }

                await protocol_start_session(
                    websocket,
                    json.dumps(session_meta, ensure_ascii=False).encode("utf-8"),
                    session_id,
                )
                await protocol_wait_for_event(
                    websocket, MsgType.FullServerResponse, EventType.SessionStarted
                )

                task_payload = copy.deepcopy(session_meta)
                task_payload["req_params"]["text"] = merged_text

                await protocol_task_request(
                    websocket,
                    json.dumps(task_payload, ensure_ascii=False).encode("utf-8"),
                    session_id,
                )
                await protocol_finish_session(websocket, session_id)

                audio_bytes = await self._collect_session_audio(websocket, session_id)
                if not audio_bytes:
                    raise RuntimeError("服务器未返回音频数据")

                await protocol_finish_connection(websocket)
                await protocol_wait_for_event(
                    websocket, MsgType.FullServerResponse, EventType.ConnectionFinished
                )

        except websockets.exceptions.WebSocketException as exc:
            suggestion = self._get_websocket_error_suggestion(str(exc))
            return self._error(f"WebSocket 调用失败：{exc}{suggestion}")
        except Exception as exc:
            return self._error(f"语音合成失败：{exc}")

        assert audio_bytes is not None
        audio_data = bytes(audio_bytes)
        file_path = None
        if save_audio:
            try:
                file_path = f"{filename}.{encoding}"
                with open(file_path, "wb") as file_handle:
                    file_handle.write(audio_data)
                self.status = f"Audio synthesized and saved to {file_path}"
            except OSError as exc:
                self.status = f"Audio synthesized but failed to save: {exc}"
        else:
            self.status = f"Audio synthesized ({encoding}, {sample_rate}Hz)"

        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
        result_data = {
            "audio_base64": audio_base64,
            "audio_type": encoding,
            "sample_rate": sample_rate,
            "duration": 0.0,
            "duration_ms": 0,
            "text": merged_text,
            "voice_display_name": self.voice_type,  # UI显示的音色名称
            "voice_type": actual_voice_type,  # API调用的实际voice_type
            "file_path": file_path,
            "audio_size": len(audio_data),
            "api_version": "v3_websocket",
        }
        return Data(data=result_data, type="audio")

    async def _collect_session_audio(self, websocket, session_id: str) -> bytearray:
        audio_buffer = bytearray()
        while True:
            message = await protocol_receive_message(websocket)

            if message.session_id and message.session_id != session_id:
                continue

            if message.type == MsgType.AudioOnlyServer:
                audio_buffer.extend(message.payload)
                continue

            if message.type == MsgType.FullServerResponse:
                if message.event == EventType.SessionFinished:
                    payload = self._decode_json_payload(message.payload)
                    if isinstance(payload, dict):
                        status_code = payload.get("status_code")
                        if status_code not in (None, 20000000):
                            msg = payload.get("message") or f"status_code={status_code}"
                            raise RuntimeError(f"会话结束失败：{msg}")
                    break

                if message.event in {
                    EventType.SessionFailed,
                    EventType.SessionCanceled,
                }:
                    payload = self._decode_json_payload(message.payload)
                    details = payload.get("message") if isinstance(payload, dict) else payload
                    raise RuntimeError(f"会话失败：{details}")

                if message.event in {
                    EventType.TTSSentenceStart,
                    EventType.TTSSentenceEnd,
                    EventType.TTSResponse,
                    EventType.TTSEnded,
                    EventType.UsageResponse,
                    EventType.SourceSubtitleStart,
                    EventType.SourceSubtitleResponse,
                    EventType.SourceSubtitleEnd,
                    EventType.TranslationSubtitleStart,
                    EventType.TranslationSubtitleResponse,
                    EventType.TranslationSubtitleEnd,
                }:
                    continue

            if message.type == MsgType.Error:
                payload_text = message.payload.decode("utf-8", "ignore")
                raise RuntimeError(f"服务器错误 {message.error_code}: {payload_text}")

        return audio_buffer

    def _build_audio_params(self):
        # 使用默认参数，不在UI中显示
        audio_params = {
            "format": "mp3",
            "sample_rate": 24000,
            "enable_timestamp": False,
            "speech_rate": 0,  # 默认语速
            "pitch_rate": 0,   # 默认音调
        }

        return audio_params

    @staticmethod
    def _build_additions():
        return {
            "disable_markdown_filter": False,
            "enable_language_detector": False,
            "enable_latex_tn": False,
            "max_length_to_filter_parenthesis": 0,
        }

    @staticmethod
    def _decode_json_payload(payload: bytes) -> Any:
        if not payload:
            return None
        try:
            return json.loads(payload.decode("utf-8"))
        except Exception:
            return None

    def _get_websocket_error_suggestion(self, error_msg: str) -> str:
        lower_error = error_msg.lower()
        if "access denied" in lower_error or "unauthorized" in lower_error:
            return (
                "\n🔧 请检查以下配置：\n"
                "1. 确认 App ID 与 Access Token 填写正确；\n"
                "2. 确保资源 ID 为 volc.service_type.10029；\n"
                "3. 在火山引擎控制台开通语音合成 v3 服务。"
            )
        if "connection" in lower_error or "connect" in lower_error:
            return (
                "\n🔧 请排查网络连接：\n"
                "1. 检查当前网络是否可访问 openspeech.bytedance.com；\n"
                "2. 确认防火墙或代理未拦截 WebSocket；\n"
                "3. 如使用代理，请在系统层配置白名单。"
            )
        if "timeout" in lower_error:
            return (
                "\n🔧 请求超时建议：\n"
                "1. 减少单次文本字数或拆分多段发送；\n"
                "2. 稍后重试，或检查网络稳定性。"
            )
        return ""

    def _merge_text(self, text: str | None, text_input: Any | None) -> str:
        parts: list[str] = []

        text_content = (text or "").strip()
        if text_content:
            parts.append(text_content)

        if text_input is not None:
            try:
                if isinstance(text_input, FlowMessage):
                    converted = text_input.get_text()
                else:
                    converted = safe_convert(text_input)
            except Exception:
                converted = str(text_input)

            converted = (converted or "").strip()
            if converted:
                parts.append(converted)

        return "\n".join(parts).strip()

    @staticmethod
    def _error(message: str) -> Data:
        return Data(data={"error": message}, type="error")


if __name__ == "__main__":
    component = DoubaoTTS()
    for field in component.inputs:
        print(f"{field.display_name}: 默认值 {field.value}")