import { NextRequest, NextResponse } from 'next/server'
import { ensureDb } from '@/lib/db'
import { generateVideo, VideoGenerationRequest } from '@/lib/video-generation'

/**
 * POST /api/video/generate - 调用 AI 生成视频
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      videoId,
      prompt,
      generationType = 'text2video',
      engine = 'doubao',
      duration,
      aspectRatio = '9:16',
      resolution = '1080p',
      style,
      sourceImage,
      sourceVideo,
      negativePrompt
    } = body

    // 验证必填字段
    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: '请提供视频生成提示词' },
        { status: 400 }
      )
    }

    console.log('[视频生成API] 开始生成...')
    console.log('引擎:', engine)
    console.log('类型:', generationType)
    console.log('提示词:', prompt.substring(0, 100) + '...')

    // 构建生成请求
    const genRequest: VideoGenerationRequest = {
      type: generationType,
      engine,
      prompt,
      duration,
      aspectRatio,
      resolution,
      style,
      sourceImage,
      sourceVideo,
      negativePrompt
    }

    // 调用视频生成服务
    const result = await generateVideo(genRequest)

    if (result.status === 'failed') {
      console.error('[视频生成API] 生成失败:', result.error)
      return NextResponse.json(
        { success: false, error: result.error || '视频生成失败' },
        { status: 500 }
      )
    }

    // 如果提供了 videoId，更新数据库
    if (videoId) {
      try {
        const db = await ensureDb()
        const now = Date.now()
        
        const updateStmt = db.prepare(`
          UPDATE videos SET
            status = 'generating',
            task_id = ?,
            prompt = ?,
            generation_type = ?,
            engine = ?,
            duration = ?,
            aspect_ratio = ?,
            resolution = ?,
            style = ?,
            source_image = ?,
            source_video = ?,
            updated_at = ?
          WHERE id = ?
        `)
        
        updateStmt.run(
          result.taskId,
          prompt,
          generationType,
          engine,
          duration || null,
          aspectRatio,
          resolution,
          style || null,
          sourceImage || null,
          sourceVideo || null,
          now,
          videoId
        )
        
        console.log('[视频生成API] 数据库更新成功, videoId:', videoId)
      } catch (dbError) {
        console.error('[视频生成API] 数据库更新失败:', dbError)
        // 不影响主流程
      }
    }

    console.log('[视频生成API] 任务创建成功, taskId:', result.taskId)

    return NextResponse.json({
      success: true,
      data: {
        taskId: result.taskId,
        status: result.status,
        engine,
        generationType,
        message: '视频生成任务已创建，请稍后查询状态'
      }
    })

  } catch (error) {
    console.error('[视频生成API] 错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '视频生成失败'
      },
      { status: 500 }
    )
  }
}
