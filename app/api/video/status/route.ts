import { NextRequest, NextResponse } from 'next/server'
import { ensureDb } from '@/lib/db'
import { getVideoStatus, VideoEngine } from '@/lib/video-generation'

/**
 * GET /api/video/status - 查询视频生成状态
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('taskId')
    const engine = searchParams.get('engine') as VideoEngine
    const videoId = searchParams.get('videoId')

    // 如果提供了 videoId，从数据库获取 taskId 和 engine
    let actualTaskId = taskId
    let actualEngine = engine

    if (videoId) {
      const db = await ensureDb()
      const stmt = db.prepare('SELECT task_id, engine, status FROM videos WHERE id = ?')
      const video: any = stmt.get(videoId)

      if (!video) {
        return NextResponse.json(
          { success: false, error: '视频不存在' },
          { status: 404 }
        )
      }

      // 如果视频已经生成完成或失败，直接返回数据库状态
      if (video.status === 'generated' || video.status === 'published') {
        const fullStmt = db.prepare('SELECT * FROM videos WHERE id = ?')
        const fullVideo: any = fullStmt.get(videoId)
        
        return NextResponse.json({
          success: true,
          data: {
            taskId: fullVideo.task_id,
            status: 'completed',
            videoUrl: fullVideo.video_url,
            coverUrl: fullVideo.cover_url,
            duration: fullVideo.duration,
            fromDatabase: true
          }
        })
      }

      if (video.status === 'failed') {
        return NextResponse.json({
          success: true,
          data: {
            taskId: video.task_id,
            status: 'failed',
            error: video.error,
            fromDatabase: true
          }
        })
      }

      actualTaskId = video.task_id
      actualEngine = video.engine
    }

    // 验证参数
    if (!actualTaskId) {
      return NextResponse.json(
        { success: false, error: '请提供 taskId 或 videoId' },
        { status: 400 }
      )
    }

    if (!actualEngine) {
      return NextResponse.json(
        { success: false, error: '请提供 engine 参数' },
        { status: 400 }
      )
    }

    console.log('[视频状态查询] taskId:', actualTaskId, 'engine:', actualEngine)

    // 查询视频生成状态
    const result = await getVideoStatus(actualEngine, actualTaskId)

    // 如果提供了 videoId 且状态有变化，更新数据库
    if (videoId && (result.status === 'completed' || result.status === 'failed')) {
      try {
        const db = await ensureDb()
        const now = Date.now()

        if (result.status === 'completed') {
          const updateStmt = db.prepare(`
            UPDATE videos SET
              status = 'generated',
              video_url = ?,
              cover_url = ?,
              duration = ?,
              generated_at = ?,
              updated_at = ?
            WHERE id = ?
          `)
          updateStmt.run(
            result.videoUrl || null,
            result.coverUrl || null,
            result.duration || null,
            now,
            now,
            videoId
          )
          console.log('[视频状态查询] 视频生成完成，已更新数据库')
        } else if (result.status === 'failed') {
          const updateStmt = db.prepare(`
            UPDATE videos SET
              status = 'failed',
              error = ?,
              updated_at = ?
            WHERE id = ?
          `)
          updateStmt.run(result.error || '视频生成失败', now, videoId)
          console.log('[视频状态查询] 视频生成失败，已更新数据库')
        }
      } catch (dbError) {
        console.error('[视频状态查询] 数据库更新失败:', dbError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: result.taskId,
        status: result.status,
        progress: result.progress,
        videoUrl: result.videoUrl,
        coverUrl: result.coverUrl,
        duration: result.duration,
        error: result.error
      }
    })

  } catch (error) {
    console.error('[视频状态查询] 错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '查询视频状态失败'
      },
      { status: 500 }
    )
  }
}
