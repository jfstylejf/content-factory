import { NextRequest, NextResponse } from 'next/server'
import { ensureDb } from '@/lib/db'
import {
  generateDigitalHumanVideo,
  getDigitalHumanStatus,
  checkDigitalHumanConfig,
  getAvailableEngines,
  DigitalHumanEngine,
  DigitalHumanMode
} from '@/lib/digital-human'

/**
 * GET /api/video/digital-human
 * 获取数字人服务配置状态和可用引擎列表
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')
    
    // 查询任务状态
    if (action === 'status') {
      const taskId = searchParams.get('taskId')
      const engine = searchParams.get('engine') as DigitalHumanEngine
      
      if (!taskId || !engine) {
        return NextResponse.json({
          success: false,
          error: '缺少 taskId 或 engine 参数'
        }, { status: 400 })
      }

      const result = await getDigitalHumanStatus(engine, taskId)
      return NextResponse.json({
        success: true,
        data: result
      })
    }

    // 获取可用引擎列表
    const engines = getAvailableEngines()
    const config = checkDigitalHumanConfig()

    return NextResponse.json({
      success: true,
      data: {
        engines,
        config,
        modes: [
          { id: 'text2avatar', name: '文本口播', description: '输入文本，AI生成数字人播报视频' },
          { id: 'audio2avatar', name: '音频驱动', description: '上传音频，数字人口型同步' }
        ]
      }
    })
  } catch (error) {
    console.error('[数字人API] GET错误:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取数字人配置失败'
    }, { status: 500 })
  }
}

/**
 * POST /api/video/digital-human
 * 创建数字人视频生成任务
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      videoId,      // 关联的视频记录ID（可选）
      engine,       // 数字人引擎
      mode,         // 生成模式
      text,         // 播报文本
      audioUrl,     // 音频URL（音频驱动模式）
      avatarId,     // 数字人形象ID
      voiceId,      // 声音ID
      aspectRatio,  // 画面比例
      resolution,   // 分辨率
      background,   // 背景
      speed,        // 语速
      pitch,        // 音调
      volume        // 音量
    } = body

    // 验证必填参数
    if (!engine) {
      return NextResponse.json({
        success: false,
        error: '请选择数字人引擎'
      }, { status: 400 })
    }

    if (!mode) {
      return NextResponse.json({
        success: false,
        error: '请选择生成模式'
      }, { status: 400 })
    }

    if (mode === 'text2avatar' && !text) {
      return NextResponse.json({
        success: false,
        error: '文本口播模式需要提供播报文本'
      }, { status: 400 })
    }

    if (mode === 'audio2avatar' && !audioUrl) {
      return NextResponse.json({
        success: false,
        error: '音频驱动模式需要提供音频URL'
      }, { status: 400 })
    }

    // 检查引擎是否可用
    const config = checkDigitalHumanConfig()
    if (!config[engine as DigitalHumanEngine]) {
      return NextResponse.json({
        success: false,
        error: `${engine} 引擎未配置，请先在 .env.local 中添加相关API密钥`
      }, { status: 400 })
    }

    // 调用数字人生成服务
    const result = await generateDigitalHumanVideo({
      engine: engine as DigitalHumanEngine,
      mode: mode as DigitalHumanMode,
      text,
      audioUrl,
      avatarId,
      voiceId,
      aspectRatio,
      resolution,
      background,
      speed,
      pitch,
      volume
    })

    if (result.status === 'failed') {
      return NextResponse.json({
        success: false,
        error: result.error || '数字人视频生成失败'
      }, { status: 500 })
    }

    // 如果有关联的视频记录，更新数据库
    if (videoId && result.taskId) {
      try {
        const db = await ensureDb()
        db.run(
          `UPDATE videos SET 
            task_id = ?, 
            status = 'generating',
            digital_human_engine = ?,
            digital_human_mode = ?,
            digital_human_avatar_id = ?,
            digital_human_voice_id = ?,
            updated_at = ?
          WHERE id = ?`,
          result.taskId,
          engine,
          mode,
          avatarId || '',
          voiceId || '',
          Date.now(),
          videoId
        )
      } catch (dbError) {
        console.error('[数字人API] 更新数据库失败:', dbError)
        // 不阻断流程
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: result.taskId,
        status: result.status,
        engine,
        mode
      }
    })
  } catch (error) {
    console.error('[数字人API] POST错误:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '创建数字人视频任务失败'
    }, { status: 500 })
  }
}
