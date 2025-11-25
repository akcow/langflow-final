#!/usr/bin/env python3
"""LangFlow精简版启动脚本"""

import sys
import os

# 设置环境变量
os.environ['LANGFLOW_SKIP_AUTH_AUTO_LOGIN'] = 'true'

# 添加路径
sys.path.insert(0, 'src/backend/base')
sys.path.insert(0, 'src/lfx/src')

# 设置启动参数
sys.argv = ['langflow', 'run', '--host', '0.0.0.0', '--port', '7860']

print("🚀 启动LangFlow精简版服务...")
print("📍 服务地址: http://localhost:7860")
print("⏳ 正在启动，请稍候...")

try:
    from langflow.__main__ import main
    main()
except KeyboardInterrupt:
    print("\n⏹️ 服务已停止")
except Exception as e:
    print(f"❌ 启动失败: {e}")
    print("💡 请检查Python环境和依赖是否正确安装")