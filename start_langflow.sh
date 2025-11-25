#!/bin/bash

echo "========================================"
echo "   LangFlow精简版启动器"
echo "========================================"
echo ""
echo "正在启动LangFlow服务..."
echo "请稍等片刻..."
echo ""

cd "$(dirname "$0")"
export LANGFLOW_SKIP_AUTH_AUTO_LOGIN=true
export PYTHONPATH="src/backend/base:src/lfx/src"

python -c "import sys; sys.path.insert(0, 'src/backend/base'); sys.path.insert(0, 'src/lfx/src'); from langflow.__main__ import main; sys.argv = ['langflow', 'run', '--host', '0.0.0.0', '--port', '7860']; main()"

echo ""
echo "服务已停止，按回车键退出..."
read