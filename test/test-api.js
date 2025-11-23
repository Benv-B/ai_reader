/**
 * API 测试脚本
 * 用于验证 Gemini API 是否配置正确
 */

require('dotenv').config();
const https = require('https');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

if (!API_KEY || API_KEY === 'your_key_here') {
    console.error('❌ 错误：未配置 GEMINI_API_KEY');
    console.log('请在 .env 文件中配置你的 API Key');
    console.log('获取地址：https://aistudio.google.com/app/apikey');
    process.exit(1);
}

console.log('🔍 正在测试 Gemini API...');
console.log(`📝 模型：${MODEL_NAME}`);
console.log(`🔑 API Key：${API_KEY.substring(0, 10)}...`);

const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

const payload = JSON.stringify({
    contents: [{
        parts: [{
            text: '请用一句话介绍你自己。'
        }]
    }]
});

const urlObj = new URL(url);
const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
};

const req = https.request(options, (res) => {
    const chunks = [];
    res.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    res.on('end', () => {
        try {
            const body = Buffer.concat(chunks).toString('utf8');
            const response = JSON.parse(body);
            
            if (response.error) {
                console.error('❌ API 调用失败：');
                console.error(response.error.message);
                process.exit(1);
            }
            
            if (response.candidates && response.candidates.length > 0) {
                const text = response.candidates[0].content.parts[0].text;
                console.log('\n✅ API 测试成功！');
                console.log('\n📨 AI 回复：');
                console.log(text);
                console.log('\n✨ 你可以运行 npm start 启动应用了！');
            } else {
                console.error('❌ 未收到翻译结果');
                process.exit(1);
            }
        } catch (err) {
            console.error('❌ 解析响应失败：', err.message);
            console.error('原始响应：', data);
            process.exit(1);
        }
    });
});

req.on('error', (err) => {
    console.error('❌ 网络错误：', err.message);
    console.log('请检查：');
    console.log('1. 网络连接是否正常');
    console.log('2. API Key 是否有效');
    console.log('3. 是否需要代理');
    process.exit(1);
});

req.write(payload);
req.end();

