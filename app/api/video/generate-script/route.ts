import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// 从环境变量获取配置
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

/**
 * POST /api/video/generate-script - 根据创意生成视频脚本和提示词
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 
      idea, 
      generationType = 'text2video',
      duration = 15,
      aspectRatio = '9:16',
      style,
      targetPlatform
    } = body

    // 验证必填字段
    if (!idea || !idea.trim()) {
      return NextResponse.json(
        { success: false, error: '请输入你的创意想法' },
        { status: 400 }
      )
    }

    // 验证 API 密钥
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API 密钥未配置' },
        { status: 500 }
      )
    }

    // 创建 OpenAI 客户端
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      baseURL: OPENAI_API_BASE
    })

    // 构建系统提示词
    const systemPrompt = `你是一位专业的短视频脚本策划师和AI视频提示词专家。
你的任务是根据用户的创意想法，生成：
1. 一个吸引人的视频标题
2. 详细的视频脚本（分镜头描述）
3. 用于AI视频生成的英文提示词（prompt）

请严格按照以下JSON格式返回：
{
  "title": "视频标题（简洁有力，适合短视频平台）",
  "description": "视频简介（100字以内，适合作为发布描述）",
  "script": "详细的分镜头脚本，描述每个场景的画面、动作、时长等",
  "prompt": "英文视频生成提示词，描述画面风格、内容、镜头运动等",
  "tags": ["标签1", "标签2", "标签3"]
}

注意事项：
- 视频时长约 ${duration} 秒
- 视频比例为 ${aspectRatio}（${aspectRatio === '9:16' ? '竖屏，适合抖音/小红书' : aspectRatio === '16:9' ? '横屏，适合B站/YouTube' : '方形'}）
${style ? `- 视频风格要求：${style}` : ''}
${targetPlatform ? `- 目标发布平台：${targetPlatform}` : ''}
- prompt 必须是英文，要详细描述画面内容、风格、镜头运动、光线、氛围等
- 脚本要具体、有画面感，适合AI视频生成`

    const userPrompt = `我的创意想法是：${idea}

请帮我生成视频脚本和AI视频生成提示词。`

    console.log('[视频脚本生成] 开始生成...')
    console.log('创意:', idea)
    console.log('时长:', duration, '秒')
    console.log('比例:', aspectRatio)

    // 调用 OpenAI API
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' }
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'AI 未返回有效内容' },
        { status: 500 }
      )
    }

    // 解析 JSON 响应
    let result
    try {
      result = JSON.parse(content)
    } catch (parseError) {
      console.error('[视频脚本生成] JSON 解析失败:', parseError)
      return NextResponse.json(
        { success: false, error: 'AI 响应格式错误' },
        { status: 500 }
      )
    }

    console.log('[视频脚本生成] 生成成功')
    console.log('标题:', result.title)

    return NextResponse.json({
      success: true,
      data: {
        title: result.title || '未命名视频',
        description: result.description || '',
        script: result.script || '',
        prompt: result.prompt || '',
        tags: result.tags || [],
        generationType,
        duration,
        aspectRatio,
        style
      }
    })

  } catch (error) {
    console.error('[视频脚本生成] 错误:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '生成视频脚本失败' 
      },
      { status: 500 }
    )
  }
}
