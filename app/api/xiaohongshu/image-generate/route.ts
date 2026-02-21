import { NextRequest, NextResponse } from 'next/server'

// Google GenAI API 配置
const ZENMUX_API_KEY = 'sk-ai-v1-e67781a65ea6b05a34334ad4661b9ab3a13929c9b57bba8e03299744ec41f218'
const ZENMUX_API_BASE = 'https://zenmux.ai/api/vertex-ai'
const IMAGE_MODEL = 'google/gemini-3-pro-image-preview-free'

export async function POST(request: NextRequest) {
  try {
    const { prompt, originalImageUrl, style } = await request.json()

    // 参数验证
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { success: false, error: '请提供图片生成提示词' },
        { status: 400 }
      )
    }

    console.log('[图片生成] 开始生成图片')
    console.log('[图片生成] 提示词:', prompt)
    console.log('[图片生成] 风格:', style || 'original')
    console.log('[图片生成] 原图URL:', originalImageUrl || '无')

    // 构建完整的提示词
    let fullPrompt = prompt

    // 根据风格添加额外的描述
    if (style && style !== 'original') {
      const styleDescriptions: Record<string, string> = {
        cartoon: '使用卡通风格，色彩明亮鲜艳，线条清晰，可爱的插画风格',
        realistic: '使用写实风格，高清照片质感，真实的光影效果，专业摄影',
        sketch: '使用手绘风格，素描线条，艺术感强，黑白或水彩效果'
      }

      if (styleDescriptions[style]) {
        fullPrompt = `${prompt}。${styleDescriptions[style]}`
      }
    }

    // 如果有原图URL，添加参考说明
    if (originalImageUrl) {
      fullPrompt = `参考原图的构图和主题，${fullPrompt}。注意：生成全新的内容，不要完全复制原图。`
    }

    console.log('[图片生成] 完整提示词:', fullPrompt)

    try {
      // 调用 Google GenAI API
      const apiUrl = `${ZENMUX_API_BASE}/v1/models/${IMAGE_MODEL}:generateContent`

      console.log('[图片生成] API URL:', apiUrl)

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ZENMUX_API_KEY}`,
          'x-goog-api-key': ZENMUX_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: fullPrompt
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            temperature: 0.8,
            maxOutputTokens: 2048
          }
        })
      })

      const responseText = await response.text()
      console.log('[图片生成] API 响应状态:', response.status)
      console.log('[图片生成] API 响应内容:', responseText.substring(0, 500))

      if (!response.ok) {
        let errorMessage = '图片生成失败'
        try {
          const errorData = JSON.parse(responseText)
          errorMessage = errorData.error?.message || errorData.message || errorMessage
        } catch {
          errorMessage = `API 错误 (${response.status}): ${responseText.substring(0, 200)}`
        }
        throw new Error(errorMessage)
      }

      const data = JSON.parse(responseText)

      // 提取生成的图片
      // 响应格式: { candidates: [{ content: { parts: [{ text/inlineData }] } }] }
      const candidates = data.candidates || []

      if (candidates.length === 0) {
        throw new Error('API 未返回任何内容')
      }

      const parts = candidates[0]?.content?.parts || []
      let imageData: string | null = null

      // 遍历所有 parts，查找图片数据
      for (const part of parts) {
        if (part.inlineData) {
          // inlineData 格式: { mimeType: "image/png", data: "base64..." }
          const mimeType = part.inlineData.mimeType || 'image/png'
          const base64Data = part.inlineData.data

          if (base64Data) {
            imageData = `data:${mimeType};base64,${base64Data}`
            console.log('[图片生成] 找到图片数据，MIME类型:', mimeType)
            console.log('[图片生成] Base64 数据长度:', base64Data.length)
            break
          }
        } else if (part.text) {
          console.log('[图片生成] 文本响应:', part.text)
        }
      }

      if (!imageData) {
        throw new Error('API 响应中未找到图片数据')
      }

      console.log('[图片生成] 生成成功')

      return NextResponse.json({
        success: true,
        data: {
          imageUrl: imageData, // Base64 data URL
          prompt: fullPrompt
        }
      })

    } catch (apiError: any) {
      console.error('[图片生成] API 调用错误:', apiError)

      // 检查是否是额度问题
      if (apiError.message?.includes('quota') || apiError.message?.includes('credits') || apiError.message?.includes('billing')) {
        throw new Error('API 额度不足，请检查账户余额')
      }

      // 检查是否是模型不支持
      if (apiError.message?.includes('not found') || apiError.message?.includes('unsupported')) {
        throw new Error('图片生成模型暂不可用，请稍后重试')
      }

      throw apiError
    }

  } catch (error) {
    console.error('[图片生成] 错误:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '图片生成过程中发生未知错误'
      },
      { status: 500 }
    )
  }
}
