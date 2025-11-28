# LangFlow 开发服务启动指南

## 🚀 快速启动

### 1. 停止所有现有服务
```bash
# Windows 命令
tasklist | findstr python
for /f "tokens=*" %i in ('tasklist /fi "IMAGENAME eq python.exe" ^| findstr "python.exe"') do (
    if not "%%i"=="" (
        taskkill /f /im python.exe /pid "%%~i" >nul 2>&1
    )
)
```

### 2. 清理所有缓存
```bash
# 进入项目目录
cd langflow-pro

# 清理前端缓存
rm -rf src/frontend/.vite
rm -rf src/frontend/node_modules/.vite

# 清理后端缓存
rm -rf src/backend/base/__pycache__
rm -rf src/backend/base/langflow/__pycache__

# 清理LFX组件缓存
rm -rf src/lfx/src/lfx/__pycache__

# 清理构建缓存
rm -rf src/frontend/build
```

### 3. 重新构建前端
```bash
cd src/frontend
npm run build
```

### 4. 同步前端文件到后端
```bash
# PowerShell 命令
Copy-Item -Path "src/frontend/build/*" -Destination "src/backend/base/langflow/frontend/" -Recurse -Force
```

### 5. 启动LangFlow服务
```bash
cd langflow-pro
export PYTHONPATH="C:\Users\wang\Desktop\langflow(2)\langflow-pro\src\backend\base;C:\Users\wang\Desktop\langflow(2)\langflow-pro\src\lfx\src" && ^
export LANGFLOW_COMPONENTS_PATH="C:\Users\wang\Desktop\langflow(2)\langflow-pro\src\lfx\src\lfx\components" && ^
export LANGFLOW_SKIP_AUTH_AUTO_LOGIN="true" && ^
python -m langflow run --host 0.0.0.0 --port 7860
```

## 🔧 完整启动脚本 (推荐)

创建一个启动脚本 `start-langflow.bat`:

```batch
@echo off
echo 🛑 停止现有服务...
for /f "tokens=*" %%i in ('tasklist /fi "IMAGENAME eq python.exe" ^| findstr "python.exe"') do (
    if not "%%i"=="" (
        taskkill /f /im python.exe /pid "%%~i" >nul 2>&1
    )
)

echo 🧹 清理缓存...
cd /d "%~dp0"langflow-pro
if exist "src\frontend\.vite" rmdir /s /q "src\frontend\.vite"
if exist "src\frontend\node_modules\.vite" rmdir /s /q "src\frontend\node_modules\.vite"
if exist "src\backend\base\__pycache__" rmdir /s /q "src\backend\base\__pycache__"
if exist "src\backend\base\langflow\__pycache__" rmdir /s /q "src\backend\base\langflow\__pycache__"
if exist "src\lfx\src\lfx\__pycache__" rmdir /s /q "src\lfx\src\lfx\__pycache__"
if exist "src\frontend\build" rmdir /s /q "src\frontend\build"

echo 🔨 重新构建前端...
cd src\frontend
npm run build

echo 📦 同步前端文件...
cd ..\
powershell -Command "Copy-Item -Path 'src\frontend\build\*' -Destination 'src\backend\base\langflow\frontend\' -Recurse -Force"

echo 🚀 启动LangFlow服务...
cd langflow-pro
set PYTHONPATH=C:\Users\wang\Desktop\langflow(2)\langflow-pro\src\backend\base;C:\Users\wang\Desktop\langflow(2)\langflow-pro\src\lfx\src
set LANGFLOW_COMPONENTS_PATH=C:\Users\wang\Desktop\langflow(2)\langflow-pro\src\lfx\src\lfx\components
set LANGFLOW_SKIP_AUTH_AUTO_LOGIN=true

echo 📱 服务地址: http://localhost:7860
echo 🔧 开发模式已启用 - 自动登录禁用
echo 🎯 豆包图片编辑组件已加载

python -m langflow run --host 0.0.0.0 --port 7860

pause
```

## 🎯 功能特性

### ✅ 当前状态
- **服务地址**: http://localhost:7860
- **自动登录**: 已禁用（开发模式）
- **豆包组件**: 已加载并配置
- **LFX组件系统**: 已激活
- **前端常驻预览**: 已启用

### 📋 完整豆包组件列表

#### 1. 豆包图片编辑 (DoubaoImageEditor)
- **功能**: 基于提示词编辑现有图片
- **模型**: Doubao-SeedEdit-3.0-i2i｜250628
- **主要参数**:
  - 图片编辑提示词（必需）
  - 原图片URL（必需）
  - 添加水印（可选）
  - 启用预览（默认开启）
- **输出**: 编辑后的图片URL和预览数据
- **特色**: 支持base64图片预览，实时状态反馈

#### 2. 豆包文生图 (DoubaoImageGenerator)
- **功能**: 根据文本提示生成新图片
- **模型**: Doubao-Seedream-3.0-t2i｜250415
- **主要参数**:
  - 生成提示词（必需）
  - 图片宽度（默认512px）
  - 图片高度（默认512px）
  - 是否添加水印（可选）
  - 启用实时预览（默认开启）
- **输出**: 生成图片的URL和预览数据
- **特色**: 自定义尺寸，引导强度控制，支持多种图片格式

#### 3. 豆包语音合成 v3 (DoubaoTTS)
- **功能**: 将文本转换为高质量语音
- **技术**: WebSocket双向流式协议
- **音色选择**（10种音色）:
  - ivi（通用场景，可配英语）
  - 大壹（视频配音-男声）
  - 黑猫侦探社咪仔（视频配音-女声）
  - 鸡汤女（视频配音-女声）
  - 魅力女友（视频配音-女声）
  - 流畅女声（视频配音-女声）
  - 儒雅逸辰（视频配音-男声）
  - 可爱女生（角色扮演-女声）
  - 调皮公主（角色扮演-女声）
  - 爽朗少年（角色扮演-男声）
  - 天才同桌（角色扮演-男声）
  - 知性灿灿（角色扮演-女声）
- **主要参数**:
  - 合成文本（必需）
  - App ID（火山引擎获取）
  - Access Token（火山引擎获取）
  - 保存音频文件（可选）
- **输出**: MP3格式的音频数据和Base64编码
- **特色**: 双向流式传输，支持中英文，24kHz采样率

#### 4. 豆包文生视频 (DoubaoVideoGenerator)
- **功能**: 根据文本生成高质量视频
- **模型**: Doubao-Seedance-1.0-pro-fast｜251015
- **主要参数**:
  - 视频生成提示词（必需）
  - 视频分辨率（480p/720p/1080p，默认1080p）
  - 视频时长（2-12秒，默认5秒）
  - 固定镜头模式（可选）
  - 添加水印（默认开启）
  - 启用预览（默认开启）
- **输出**: 视频URL、封面图片和详细信息
- **特色**: 异步任务处理，状态轮询，封面预览生成
- **支持**: 纯文生视频、图生视频（提供首帧图片时）

### 🔧 组件通用配置

#### 环境变量配置
```bash
# 豆包图片编辑/生成
ARK_API_KEY=your_doubao_api_key_here

# 豆包语音合成
TS_APP_ID=4942118390  # 火山引擎语音合成v3页面获取的纯数字App ID
TS_TOKEN=your_access_token_here  # 火山引擎语音合成v3页面获取的Access Token
```

#### API密钥获取方式
1. **豆包图像服务**:
   - 访问豆包控制台
   - 开通图像生成和图像编辑服务
   - 获取ARK_API_KEY

2. **豆包语音合成v3**:
   - 访问火山引擎语音合成v3页面
   - 创建应用获取App ID（纯数字格式）
   - 生成Access Token（任意格式）
   - 配置资源ID: volc.service_type.10029

### ⚡ 性能优化建议

#### 图片组件优化
- 建议使用512的倍数作为图片尺寸
- 预览功能会增加内存使用，大文件可关闭
- 编辑图片时，引导强度使用默认值5.5效果最佳

#### 语音组件优化
- 单次文本建议控制在500字以内
- WebSocket连接失败时检查网络和防火墙设置
- MP3格式适合大多数场景，24kHz采样率平衡质量和大小

#### 视频组件优化
- 1080p分辨率提供最佳质量，但生成时间较长
- 短视频（2-5秒）生成速度更快
- 首帧图片可有效控制视频起始内容
- 轮询间隔3秒平衡实时性和服务器压力

### 🔍 豆包图片编辑组件使用

1. **创建新流程**: 点击 "+" 创建新的流程
2. **添加豆包组件**: 在组件库中搜索 "豆包图片编辑"
3. **组件配置**:
   - 模型名称: 选择 "Doubao-SeedEdit-3.0-i2i｜250628"
   - 图片编辑提示词: 输入你想要的编辑描述
   - 原图片URL: 输入要编辑的图片地址
   - API密钥: 可在节点中配置，或使用环境变量 ARK_API_KEY
   - 启用预览: 启用以查看编辑后的图片预览

4. **组件输出**:
   - 编辑结果: 包含编辑后的图片URL和预览数据
   - 预览功能: 自动生成base64编码的图片预览

## 🚨 故障排除

### 问题1: 页面显示异常（色块、图形错乱）
**解决方案**:
1. **强制刷新浏览器**: `Ctrl + Shift + R`
2. **清除浏览器缓存**:
   - Chrome: `Ctrl + Shift + Delete`
   - 或按 `F12` -> 右键刷新按钮 -> "清空缓存并硬性重新加载"
3. **使用无痕模式**: `Ctrl + Shift + N`

### 问题2: 连接被拒绝 (localhost 拒绝连接)
**解决方案**:
1. **检查端口占用**:
   ```bash
   netstat -ano | findstr ":7860"
   ```
2. **使用完整脚本**: 运行上面的 `start-langflow.bat`
3. **检查环境变量**: 确保 PYTHONPATH 和 LANGFLOW_COMPONENTS_PATH 正确设置

### 问题3: 组件未找到
**解决方案**:
1. **检查组件路径**:
   ```bash
   echo %LANGFLOW_COMPONENTS_PATH%
   ```
2. **重新加载组件**: 在LangFlow界面中点击 "刷新" 按钮
3. **检查文件权限**: 确保组件目录可读

## 🔧 开发调试

### 启用开发模式
```bash
# 在启动命令中添加
set LANGFLOW_DEBUG=true
set LANGFLOW_LOG_LEVEL=debug
```

### 查看日志
```bash
# 日志文件位置
# Windows: %APPDATA%\langflow\logs\
# 或者在控制台输出中查看实时日志
```

## 📝 验证清单

启动后请确认以下项目：

- [ ] http://localhost:7860 可以正常访问
- [ ] 页面显示正常的LangFlow界面（无色块或错乱图形）
- [ ] 豆包图片编辑组件在组件库中可见
- [ ] 可以创建包含豆包组件的新流程
- [ ] 豆包组件的预览功能正常工作
- [ ] 控制台无严重错误信息

## 🔄 日常开发流程

### 修改代码后重启
1. 修改LFX组件代码
2. 停止当前服务: `Ctrl + C`
3. 清理Python缓存: `rm -rf src/lfx/src/lfx/__pycache__`
4. 重新启动: 运行启动脚本或完整命令

### 更新组件
1. 修改组件文件后，LangFlow会自动重新加载
2. 如需强制刷新: 在界面中点击刷新按钮
3. 检查组件输出: 在组件的输出面板查看结果

## 📚 组件开发注意

### 豆包组件路径
- **组件文件**: `src/lfx/src/lfx/components/doubao/`
- **主要文件**:
  - `doubao_image_generator.py` - 图片生成
  - `doubao_image_editor.py` - 图片编辑
  - `__init__.py` - 组件注册

### 修改组件
1. **编辑组件文件**后，自动重新加载
2. **测试功能**: 在流程中测试组件
3. **检查日志**: 查看组件初始化和执行日志

---

## 🎉 总结

按照本指南启动的LangFlow服务将包含：
- ✅ 正确的环境配置
- ✅ 完整的豆包图片编辑组件
- ✅ 前端预览功能支持
- ✅ 开发友好的调试信息
- ✅ 自动化的缓存管理

如遇到问题，请参考故障排除部分或查看控制台日志。