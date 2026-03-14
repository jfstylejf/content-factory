import { NextRequest, NextResponse } from 'next/server'
import { ensureDb } from '@/lib/db'

// GET /api/video - 获取视频列表
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const engine = searchParams.get('engine')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const db = await ensureDb()

    // 构建查询
    let query = 'SELECT * FROM videos WHERE 1=1'
    const params: any[] = []

    if (status && status !== 'all') {
      query += ' AND status = ?'
      params.push(status)
    }

    if (engine && engine !== 'all') {
      query += ' AND engine = ?'
      params.push(engine)
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const stmt = db.prepare(query)
    const videos = stmt.all(...params)

    // 解析 JSON 字段
    const parsedVideos = videos.map((video: any) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      idea: video.idea,
      script: video.script,
      prompt: video.prompt,
      generationType: video.generation_type,
      engine: video.engine,
      duration: video.duration,
      aspectRatio: video.aspect_ratio,
      resolution: video.resolution,
      style: video.style,
      sourceImage: video.source_image,
      sourceVideo: video.source_video,
      videoUrl: video.video_url,
      coverUrl: video.cover_url,
      thumbnailUrl: video.thumbnail_url,
      status: video.status,
      error: video.error,
      platforms: JSON.parse(video.platforms || '[]'),
      publishConfig: video.publish_config ? JSON.parse(video.publish_config) : null,
      scheduledAt: video.scheduled_at,
      taskId: video.task_id,
      createdAt: video.created_at,
      updatedAt: video.updated_at,
      generatedAt: video.generated_at,
      publishedAt: video.published_at
    }))

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM videos WHERE 1=1'
    const countParams: any[] = []

    if (status && status !== 'all') {
      countQuery += ' AND status = ?'
      countParams.push(status)
    }

    if (engine && engine !== 'all') {
      countQuery += ' AND engine = ?'
      countParams.push(engine)
    }

    const countStmt = db.prepare(countQuery)
    const countResult: any = countStmt.get(...countParams)

    return NextResponse.json({
      success: true,
      data: {
        videos: parsedVideos,
        total: countResult?.total || 0,
        limit,
        offset
      }
    })
  } catch (error) {
    console.error('[获取视频列表] 错误:', error)
    return NextResponse.json(
      { success: false, error: '获取视频列表失败' },
      { status: 500 }
    )
  }
}

// POST /api/video - 创建视频草稿
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      title,
      description,
      idea,
      script,
      prompt,
      generationType = 'text2video',
      engine = 'doubao',
      duration,
      aspectRatio = '9:16',
      resolution = '1080p',
      style,
      sourceImage,
      sourceVideo,
      publishConfig,
      scheduledAt
    } = body

    // 验证必填字段
    if (!title) {
      return NextResponse.json(
        { success: false, error: '标题不能为空' },
        { status: 400 }
      )
    }

    const db = await ensureDb()
    const now = Date.now()

    // 插入视频
    const stmt = db.prepare(`
      INSERT INTO videos (
        title, description, idea, script, prompt,
        generation_type, engine, duration, aspect_ratio, resolution, style,
        source_image, source_video, publish_config, scheduled_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      title,
      description || null,
      idea || null,
      script || null,
      prompt || null,
      generationType,
      engine,
      duration || null,
      aspectRatio,
      resolution,
      style || null,
      sourceImage || null,
      sourceVideo || null,
      publishConfig ? JSON.stringify(publishConfig) : null,
      scheduledAt || null,
      now
    )

    return NextResponse.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        title,
        description,
        idea,
        script,
        prompt,
        generationType,
        engine,
        duration,
        aspectRatio,
        resolution,
        style,
        sourceImage,
        sourceVideo,
        status: 'draft',
        publishConfig,
        scheduledAt,
        createdAt: now
      }
    })
  } catch (error) {
    console.error('[创建视频] 错误:', error)
    return NextResponse.json(
      { success: false, error: '创建视频失败' },
      { status: 500 }
    )
  }
}

// PUT /api/video - 更新视频
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id,
      title,
      description,
      idea,
      script,
      prompt,
      generationType,
      engine,
      duration,
      aspectRatio,
      resolution,
      style,
      sourceImage,
      sourceVideo,
      videoUrl,
      coverUrl,
      status,
      publishConfig,
      scheduledAt
    } = body

    // 验证必填字段
    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少视频ID' },
        { status: 400 }
      )
    }

    const db = await ensureDb()
    const now = Date.now()

    // 构建更新语句
    const updates: string[] = []
    const values: any[] = []

    if (title !== undefined) {
      updates.push('title = ?')
      values.push(title)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description)
    }
    if (idea !== undefined) {
      updates.push('idea = ?')
      values.push(idea)
    }
    if (script !== undefined) {
      updates.push('script = ?')
      values.push(script)
    }
    if (prompt !== undefined) {
      updates.push('prompt = ?')
      values.push(prompt)
    }
    if (generationType !== undefined) {
      updates.push('generation_type = ?')
      values.push(generationType)
    }
    if (engine !== undefined) {
      updates.push('engine = ?')
      values.push(engine)
    }
    if (duration !== undefined) {
      updates.push('duration = ?')
      values.push(duration)
    }
    if (aspectRatio !== undefined) {
      updates.push('aspect_ratio = ?')
      values.push(aspectRatio)
    }
    if (resolution !== undefined) {
      updates.push('resolution = ?')
      values.push(resolution)
    }
    if (style !== undefined) {
      updates.push('style = ?')
      values.push(style)
    }
    if (sourceImage !== undefined) {
      updates.push('source_image = ?')
      values.push(sourceImage)
    }
    if (sourceVideo !== undefined) {
      updates.push('source_video = ?')
      values.push(sourceVideo)
    }
    if (videoUrl !== undefined) {
      updates.push('video_url = ?')
      values.push(videoUrl)
    }
    if (coverUrl !== undefined) {
      updates.push('cover_url = ?')
      values.push(coverUrl)
    }
    if (status !== undefined) {
      updates.push('status = ?')
      values.push(status)
    }
    if (publishConfig !== undefined) {
      updates.push('publish_config = ?')
      values.push(JSON.stringify(publishConfig))
    }
    if (scheduledAt !== undefined) {
      updates.push('scheduled_at = ?')
      values.push(scheduledAt)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有需要更新的字段' },
        { status: 400 }
      )
    }

    updates.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const stmt = db.prepare(`UPDATE videos SET ${updates.join(', ')} WHERE id = ?`)
    const result = stmt.run(...values)

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: '视频不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '视频已更新'
    })
  } catch (error) {
    console.error('[更新视频] 错误:', error)
    return NextResponse.json(
      { success: false, error: '更新视频失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/video - 删除视频
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少视频ID' },
        { status: 400 }
      )
    }

    const db = await ensureDb()
    const stmt = db.prepare('DELETE FROM videos WHERE id = ?')
    const result = stmt.run(id)

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: '视频不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '视频已删除'
    })
  } catch (error) {
    console.error('[删除视频] 错误:', error)
    return NextResponse.json(
      { success: false, error: '删除视频失败' },
      { status: 500 }
    )
  }
}
