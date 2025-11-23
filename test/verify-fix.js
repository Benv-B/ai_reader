/**
 * 验证 UTF-8 分块处理修复的测试脚本
 * 
 * 模拟 HTTP 响应将多字节字符（如中文）拆分到两个 data chunk 中的情况。
 * 如果修复有效，最终应该能正确还原字符，不出现问号。
 */

const { Buffer } = require('buffer');

function testChunkedResponse() {
    console.log("🧪 开始测试 UTF-8 分块重组逻辑...");

    // 1. 准备测试数据
    // "你好" 的 UTF-8 编码:
    // 你: e4 bd a0
    // 好: e5 a5 bd
    const originalText = JSON.stringify({ text: "你好" }); 
    const fullBuffer = Buffer.from(originalText, 'utf8');
    
    console.log(`原始数据: ${originalText}`);
    console.log(`Buffer 长度: ${fullBuffer.length}`);

    // 2. 模拟拆分：在“你”字的中间拆分
    // "{"text":"你" 前面有 {"text":" (9 bytes) + 你 (3 bytes)
    // 我们在第 10 个字节处拆分 (即 "你" 的第 1 个字节之后)
    const splitIndex = 10; 
    const chunk1 = fullBuffer.subarray(0, splitIndex);
    const chunk2 = fullBuffer.subarray(splitIndex);

    console.log(`Chunk 1 长度: ${chunk1.length} (末尾字节: ${chunk1[chunk1.length-1].toString(16)})`);
    console.log(`Chunk 2 长度: ${chunk2.length} (开头字节: ${chunk2[0].toString(16)})`);

    // 3. 模拟旧的错误逻辑 (直接 toString 拼接)
    const badBody = chunk1.toString('utf8') + chunk2.toString('utf8');
    console.log(`\n❌ [模拟旧逻辑] 直接 toString 拼接结果:`);
    console.log(badBody);
    if (badBody.includes('') || badBody.includes('?')) {
        console.log("-> 确认旧逻辑会导致乱码");
    }

    // 4. 测试当前的修复逻辑 (Buffer 累积)
    console.log(`\n✅ [测试新逻辑] Buffer.concat 累积结果:`);
    const chunks = [];
    
    // 模拟接收数据
    chunks.push(chunk1);
    chunks.push(chunk2);

    // 合并
    const combinedBuffer = Buffer.concat(chunks);
    const decodedBody = combinedBuffer.toString('utf8');
    
    console.log(decodedBody);

    if (decodedBody === originalText) {
        console.log("-> 🎉 测试通过！字符已完美还原。");
    } else {
        console.error("-> ❌ 测试失败！还原的字符不匹配。");
    }
}

testChunkedResponse();

