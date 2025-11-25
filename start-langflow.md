# 🚀 LangFlow 本地启动指南

> **完整的 LangFlow 本地开发环境搭建和启动流程**
> **包含豆包（Doubao）AI 集成预览功能**

## 📋 目录

- [环境准备](#1️⃣-环境准备)
- [前端依赖安装](#2️⃣-前端依赖安装)
- [构建前端](#3️⃣-构建前端)
- [同步静态资源](#4️⃣-同步静态资源)
- [设置环境变量](#5️⃣-设置环境变量)
- [启动服务](#6️⃣-启动服务)
- [验证功能](#7️⃣-验证功能)
- [服务管理](#8️⃣-服务管理)
- [常见问题](#9️⃣-常见问题与解决方案)
- [快速启动脚本](#🔟-快速启动脚本)

---

## 1️⃣ 环境准备

### 基础要求
- ✅ Python 3.8+ 环境
- ✅ Node.js 16+ 环境
- ✅ PowerShell 终端
- ✅ Git（用于版本管理）

### 项目路径配置
```powershell
# 设置项目根目录（根据实际情况修改）
$PROJECT_ROOT = "C:\Users\wang\Desktop\langflow(2)\langflow-pro"
$PYTHON_ENV = "D:\Anaconda\python.exe"  # 你的 Python 解释器路径
```

---

## 2️⃣ 前端依赖安装

> **⚠️ 仅需在首次设置或更新依赖时执行**

```powershell
# 进入前端目录
cd $PROJECT_ROOT\src\frontend

# 安装依赖（首次运行或依赖更新时）
npm install

# 验证安装
npm --version
node --version
```

---

## 3️⃣ 构建前端

> **🔄 每次修改前端代码（包括豆包预览面板）后都需要重新构建**

```powershell
# 进入前端目录
cd $PROJECT_ROOT\src\frontend

# 清理旧的构建文件（可选）
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue

# 执行构建
npm run build

# 验证构建结果
Get-ChildItem $PROJECT_ROOT\src\frontend\build\assets\index-*.js | Select-Object Name, LastWriteTime
```

**✅ 构建成功标志：**
- `src/frontend/build/assets/index-*.js` 文件的时间戳为当前时间
- 控制台显示构建成功信息
- `build` 目录包含完整的静态资源

---

## 4️⃣ 同步静态资源

> **📦 将构建好的前端资源同步到后端服务目录**

```powershell
# 返回项目根目录
cd $PROJECT_ROOT

# 同步前端资源到后端（使用 robocopy 确保完整镜像）
robocopy src\frontend\build src\backend\base\langflow\frontend /MIR /NFL /NDL

# 验证同步结果
if (Test-Path src\backend\base\langflow\frontend\index.html) {
    Write-Host "✅ 前端资源同步成功！" -ForegroundColor Green
} else {
    Write-Host "❌ 前端资源同步失败！" -ForegroundColor Red
}
```

---

## 5️⃣ 设置环境变量

> **⚙️ 在同一个 PowerShell 会话中设置以下环境变量**

```powershell
# 设置 Python 路径（重要：确保能找到自定义组件）
$env:PYTHONPATH = "$PROJECT_ROOT\src\backend\base;$PROJECT_ROOT\src\lfx\src"

# 设置 LangFlow 组件路径
$env:LANGFLOW_COMPONENTS_PATH = "$PROJECT_ROOT\src\lfx\src\lfx\components"

# 跳过自动登录（开发环境推荐）
$env:LANGFLOW_SKIP_AUTH_AUTO_LOGIN = "true"

# 可选：设置其他有用变量
$env:LANGFLOW_LOG_LEVEL = "INFO"
$env:LANGFLOW_DATABASE_URL = "sqlite:///langflow.db"

# 验证环境变量设置
Get-ChildItem env: | Where-Object { $_.Name -like "*LANGFLOW*" -or $_.Name -eq "PYTHONPATH" }
```

---

## 6️⃣ 启动服务

### 方式一：前台启动（推荐开发时使用）
```powershell
cd $PROJECT_ROOT
python -m langflow run --host 0.0.0.0 --port 7860
```

### 方式二：后台启动（生产环境或需要多服务时）
```powershell
cd $PROJECT_ROOT
Start-Process -FilePath "python" -ArgumentList "-m", "langflow", "run", "--host", "0.0.0.0", "--port", "7860" -WorkingDirectory $PROJECT_ROOT

# 获取进程信息
Get-Process | Where-Object { $_.ProcessName -eq "python" } | Select-Object Id, ProcessName, StartTime
```

### 方式三：启动脚本（推荐日常使用）
```powershell
# 创建快速启动脚本
$startScript = @"
cd `"$PROJECT_ROOT`"
`$env:PYTHONPATH = `"$PROJECT_ROOT\src\backend\base;$PROJECT_ROOT\src\lfx\src`"
`$env:LANGFLOW_COMPONENTS_PATH = `"$PROJECT_ROOT\src\lfx\src\lfx\components`"
`$env:LANGFLOW_SKIP_AUTH_AUTO_LOGIN = `"true`"
python -m langflow run --host 0.0.0.0 --port 7860
"@

# 保存到项目根目录
$startScript | Out-File -FilePath "$PROJECT_ROOT\start-dev.ps1" -Encoding UTF8
Write-Host "✅ 启动脚本已创建：$PROJECT_ROOT\start-dev.ps1" -ForegroundColor Green
```

---

## 7️⃣ 验证功能

### 🌐 访问服务
1. **浏览器访问**：[http://localhost:7860](http://localhost:7860)
2. **服务状态检查**：[http://localhost:7860/health_check](http://localhost:7860/health_check)

### 🔍 验证前端构建
1. 打开浏览器开发者工具（F12）
2. 切换到 **Network** 标签
3. 刷新页面（Ctrl+F5）
4. 找到 `index-*.js` 文件，检查 `Last-Modified` 时间是否为最近的构建时间

### 🤖 验证豆包预览功能
1. 在 LangFlow 编辑器中添加任意 **豆包（Doubao）** 节点
2. 检查是否出现"实时预览"面板
3. 如果没有预览面板：
   - 查看 Console 面板是否有错误信息
   - 尝试硬刷新（Ctrl+F5）
   - 使用隐私/无痕模式重新打开

---

## 8️⃣ 服务管理

### 🔍 查看运行中的服务
```powershell
# 检查端口占用
netstat -ano | findstr ":7860"

# 查找 Python 进程
Get-Process python | Select-Object Id, ProcessName, StartTime

# 更详细的服务信息
tasklist | findstr python
```

### 🛑 停止服务
```powershell
# 方式一：通过进程 ID 停止
$pythonPid = (Get-Process python).Id
Stop-Process -Id $pythonPid -Force

# 方式二：通过端口停止（更精确）
$portProcess = netstat -ano | findstr ":7860" | ForEach-Object { ($_ -split '\s+')[-1] }
Stop-Process -Id $portProcess -Force

# 方式三：停止所有 Python 进程（谨慎使用）
Get-Process python | Stop-Process -Force
```

### 🔄 重启服务
```powershell
# 停止现有服务
Get-Process python | Stop-Process -Force

# 等待进程完全停止
Start-Sleep -Seconds 3

# 重新启动
cd $PROJECT_ROOT
python -m langflow run --host 0.0.0.0 --port 7860
```

---

## 9️⃣ 常见问题与解决方案

### ❌ 问题1：端口被占用
**错误信息**：`Error: [Errno 10048] Address already in use`

**解决方案**：
```powershell
# 查找占用端口的进程
netstat -ano | findstr ":7860"

# 停止占用进程的 ID
Stop-Process -Id <PID> -Force

# 或者使用其他端口
python -m langflow run --host 0.0.0.0 --port 7861
```

### ❌ 问题2：找不到自定义组件
**错误信息**：`ModuleNotFoundError: No module named 'lfx'`

**解决方案**：
```powershell
# 检查 PYTHONPATH 设置
echo $env:PYTHONPATH

# 重新设置环境变量
$env:PYTHONPATH = "$PROJECT_ROOT\src\backend\base;$PROJECT_ROOT\src\lfx\src"

# 验证路径是否存在
Test-Path "$PROJECT_ROOT\src\lfx\src"
```

### ❌ 问题3：前端资源未更新
**现象**：修改前端后页面没有变化

**解决方案**：
```powershell
# 1. 重新构建前端
cd $PROJECT_ROOT\src\frontend
npm run build

# 2. 清理浏览器缓存
# Ctrl+F5 硬刷新或使用隐私模式

# 3. 重新同步资源
cd $PROJECT_ROOT
robocopy src\frontend\build src\backend\base\langflow\frontend /MIR
```

### ❌ 问题4：豆包预览面板不显示
**解决方案**：
1. 检查浏览器控制台是否有 JavaScript 错误
2. 确认前端构建包含最新代码
3. 尝试清除浏览器缓存和 Cookie
4. 使用隐私/无痕模式重新访问

### ❌ 问题5：权限问题
**错误信息**：`Access denied` 或权限相关错误

**解决方案**：
```powershell
# 以管理员身份运行 PowerShell
# 或者检查文件夹权限
icacls $PROJECT_ROOT /grant "${env:USERNAME}:(OI)(CI)F" /T
```

---

## 🔟 快速启动脚本

### 📄 一键启动脚本
创建 `quick-start.ps1` 文件：

```powershell
# 设置项目路径
$PROJECT_ROOT = "C:\Users\wang\Desktop\langflow(2)\langflow-pro"

Write-Host "🚀 启动 LangFlow 开发环境..." -ForegroundColor Cyan

# 1. 构建前端
Write-Host "📦 构建前端资源..." -ForegroundColor Yellow
cd "$PROJECT_ROOT\src\frontend"
npm run build

# 2. 同步资源
Write-Host "🔄 同步静态资源..." -ForegroundColor Yellow
cd "$PROJECT_ROOT"
robocopy src\frontend\build src\backend\base\langflow\frontend /MIR /NFL /NDL

# 3. 设置环境变量
Write-Host "⚙️ 设置环境变量..." -ForegroundColor Yellow
$env:PYTHONPATH = "$PROJECT_ROOT\src\backend\base;$PROJECT_ROOT\src\lfx\src"
$env:LANGFLOW_COMPONENTS_PATH = "$PROJECT_ROOT\src\lfx\src\lfx\components"
$env:LANGFLOW_SKIP_AUTH_AUTO_LOGIN = "true"

# 4. 启动服务
Write-Host "🌟 启动 LangFlow 服务..." -ForegroundColor Green
Write-Host "访问地址: http://localhost:7860" -ForegroundColor White
cd "$PROJECT_ROOT"
python -m langflow run --host 0.0.0.0 --port 7860
```

### 🛠️ 一键停止脚本
创建 `stop-services.ps1` 文件：

```powershell
Write-Host "🛑 停止 LangFlow 服务..." -ForegroundColor Yellow

# 查找并停止占用 7860 端口的进程
$portProcess = netstat -ano | findstr ":7860" | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -Unique

if ($portProcess) {
    Write-Host "停止进程 ID: $portProcess" -ForegroundColor Red
    Stop-Process -Id $portProcess -Force
    Write-Host "✅ 服务已停止" -ForegroundColor Green
} else {
    Write-Host "ℹ️ 未找到运行中的服务" -ForegroundColor Blue
}

# 额外清理 Python 进程
Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*langflow*" } | Stop-Process -Force
```

---

## 💡 开发建议

### 🔄 开发工作流程
1. **修改前端代码** → 重新构建 → 同步资源 → 重启服务
2. **修改后端代码** → 重启服务（无需重新构建前端）
3. **添加新组件** → 确保在 `lfx/components` 目录下 → 重启服务

### 📝 日志调试
```powershell
# 启用详细日志
$env:LANGFLOW_LOG_LEVEL = "DEBUG"
python -m langflow run --host 0.0.0.0 --port 7860 --log-level DEBUG
```

### 🔒 安全提示
- 生产环境请关闭 `LANGFLOW_SKIP_AUTH_AUTO_LOGIN`
- 使用适当的 CORS 配置：`$env:LANGFLOW_CORS_ORIGINS = "http://yourdomain.com"`
- 定期更新依赖包和组件

---

## 📞 技术支持

- 📚 [LangFlow 官方文档](https://docs.langflow.org/)
- 🐛 [问题反馈](https://github.com/langflow-ai/langflow/issues)
- 💬 [社区讨论](https://discord.com/invite/EqksyE2EX9)

---

**🎉 现在您可以开始使用 LangFlow 了！**
访问 [http://localhost:7860](http://localhost:7860) 开始您的 AI 工作流开发之旅。