/**
 * 视频生成服务
 * 支持豆包 Seedance 2.0 和阿里云 Wan 2.6 双引擎
 */

// ===================== 类型定义 =====================

export type VideoGenerationType = 'text2video' | 'image2video' | 'video2video'
export type VideoEngine = 'doubao' | 'wan'
export type AspectRatio = '9:16' | '16:9' | '1:1'
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface VideoGenerationRequest {
  type: VideoGenerationType
  engine: VideoEngine
  prompt: string
  sourceImage?: string   // 图生视频的源图片 URL
  sourceVideo?: string   // 视频续写的源视频 URL
  duration?: number      // 时长(秒)
  aspectRatio?: AspectRatio
  resolution?: string
  style?: string
  negativePrompt?: string
}

export interface VideoGenerationResult {
  taskId: string
  status: VideoStatus
  videoUrl?: string
  coverUrl?: string
  duration?: number
  error?: string
  rawResponse?: any
}

export interface VideoStatusResult {
  taskId: string
  status: VideoStatus
  progress?: number      // 0-100
  videoUrl?: string
  coverUrl?: string
  duration?: number
  error?: string
  rawResponse?: any
}

// ===================== 环境变量 =====================

// 火山引擎 - 豆包视频生成
const VOLCENGINE_ACCESS_KEY = process.env.VOLCENGINE_ACCESS_KEY || ''
const VOLCENGINE_SECRET_KEY = process.env.VOLCENGINE_SECRET_KEY || ''
const DOUBAO_VIDEO_ENDPOINT = process.env.DOUBAO_VIDEO_ENDPOINT || 'https://open.volcengineapi.com'

// 阿里云 DashScope - 通义万相
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || ''
const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1'

// ===================== 豆包 Seedance 2.0 实现 =====================

/**
 * 使用豆包 Seedance 2.0 生成视频
 * 文档: https://www.volcengine.com/docs/82379/1399424
 */
export async function generateWithDoubao(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
  console.log('[豆包视频生成] 开始生成...')
  console.log('类型:', req.type)
  console.log('提示词:', req.prompt?.substring(0, 100) + '...')

  if (!VOLCENGINE_ACCESS_KEY || !VOLCENGINE_SECRET_KEY) {
    return {
      taskId: '',
      status: 'failed',
      error: '火山引擎 API 密钥未配置'
    }
  }

  try {
    // 构建请求体
    const requestBody: any = {
      model: 'seedance-2.0',  // Seedance 2.0 模型
      prompt: req.prompt,
      duration: req.duration || 5,
      aspect_ratio: req.aspectRatio || '9:16',
    }

    // 图生视频
    if (req.type === 'image2video' && req.sourceImage) {
      requestBody.image_url = req.sourceImage
    }

    // 视频续写
    if (req.type === 'video2video' && req.sourceVideo) {
      requestBody.video_url = req.sourceVideo
    }

    // 负面提示词
    if (req.negativePrompt) {
      requestBody.negative_prompt = req.negativePrompt
    }

    // 调用火山引擎 API
    // 注意：实际调用需要使用火山引擎 SDK 进行签名认证
    // 这里提供基础结构，实际部署时需要根据火山引擎文档完善签名逻辑
    const response = await fetch(`${DOUBAO_VIDEO_ENDPOINT}/api/v3/video/generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VOLCENGINE_ACCESS_KEY}`,
        // 实际需要添加火山引擎的签名头
      },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[豆包视频生成] API 错误:', data)
      return {
        taskId: '',
        status: 'failed',
        error: data.error?.message || data.message || '豆包视频生成失败',
        rawResponse: data
      }
    }

    console.log('[豆包视频生成] 任务创建成功, taskId:', data.data?.task_id)

    return {
      taskId: data.data?.task_id || '',
      status: 'pending',
      rawResponse: data
    }
  } catch (error) {
    console.error('[豆包视频生成] 异常:', error)
    return {
      taskId: '',
      status: 'failed',
      error: error instanceof Error ? error.message : '豆包视频生成异常'
    }
  }
}

/**
 * 查询豆包视频生成状态
 */
export async function getDoubaoVideoStatus(taskId: string): Promise<VideoStatusResult> {
  if (!VOLCENGINE_ACCESS_KEY || !VOLCENGINE_SECRET_KEY) {
    return {
      taskId,
      status: 'failed',
      error: '火山引擎 API 密钥未配置'
    }
  }

  try {
    const response = await fetch(`${DOUBAO_VIDEO_ENDPOINT}/api/v3/video/generation/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VOLCENGINE_ACCESS_KEY}`,
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        taskId,
        status: 'failed',
        error: data.error?.message || '查询失败',
        rawResponse: data
      }
    }

    // 解析状态
    const taskStatus = data.data?.status
    let status: VideoStatus = 'pending'
    
    if (taskStatus === 'PROCESSING' || taskStatus === 'RUNNING') {
      status = 'processing'
    } else if (taskStatus === 'SUCCESS' || taskStatus === 'COMPLETED') {
      status = 'completed'
    } else if (taskStatus === 'FAILED' || taskStatus === 'ERROR') {
      status = 'failed'
    }

    return {
      taskId,
      status,
      progress: data.data?.progress,
      videoUrl: data.data?.video_url,
      coverUrl: data.data?.cover_url,
      duration: data.data?.duration,
      error: data.data?.error_message,
      rawResponse: data
    }
  } catch (error) {
    console.error('[豆包视频状态查询] 异常:', error)
    return {
      taskId,
      status: 'failed',
      error: error instanceof Error ? error.message : '查询异常'
    }
  }
}

// ===================== 阿里云 Wan 2.6 实现 =====================

/**
 * 使用阿里云 Wan 2.6 生成视频
 * 文档: https://help.aliyun.com/zh/dashscope/developer-reference/tongyi-wanxiang-video-generation
 */
export async function generateWithWan(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
  console.log('[Wan视频生成] 开始生成...')
  console.log('类型:', req.type)
  console.log('提示词:', req.prompt?.substring(0, 100) + '...')

  if (!DASHSCOPE_API_KEY) {
    return {
      taskId: '',
      status: 'failed',
      error: '阿里云 DashScope API 密钥未配置'
    }
  }

  try {
    // 构建请求体
    const requestBody: any = {
      model: 'wanx-video-generation-v2.6',
      input: {
        prompt: req.prompt,
      },
      parameters: {
        duration: req.duration || 5,
        aspect_ratio: req.aspectRatio || '9:16',
        resolution: req.resolution || '1080p'
      }
    }

    // 图生视频
    if (req.type === 'image2video' && req.sourceImage) {
      requestBody.input.image_url = req.sourceImage
    }

    // 视频续写
    if (req.type === 'video2video' && req.sourceVideo) {
      requestBody.input.video_url = req.sourceVideo
    }

    // 负面提示词
    if (req.negativePrompt) {
      requestBody.input.negative_prompt = req.negativePrompt
    }

    // 调用 DashScope API
    const response = await fetch(`${DASHSCOPE_BASE_URL}/services/aigc/video-generation/video-synthesis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'X-DashScope-Async': 'enable'  // 异步任务
      },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    if (!response.ok || data.code) {
      console.error('[Wan视频生成] API 错误:', data)
      return {
        taskId: '',
        status: 'failed',
        error: data.message || 'Wan 视频生成失败',
        rawResponse: data
      }
    }

    console.log('[Wan视频生成] 任务创建成功, taskId:', data.output?.task_id)

    return {
      taskId: data.output?.task_id || '',
      status: 'pending',
      rawResponse: data
    }
  } catch (error) {
    console.error('[Wan视频生成] 异常:', error)
    return {
      taskId: '',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Wan 视频生成异常'
    }
  }
}

/**
 * 查询 Wan 视频生成状态
 */
export async function getWanVideoStatus(taskId: string): Promise<VideoStatusResult> {
  if (!DASHSCOPE_API_KEY) {
    return {
      taskId,
      status: 'failed',
      error: '阿里云 DashScope API 密钥未配置'
    }
  }

  try {
    const response = await fetch(`${DASHSCOPE_BASE_URL}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      }
    })

    const data = await response.json()

    if (!response.ok || data.code) {
      return {
        taskId,
        status: 'failed',
        error: data.message || '查询失败',
        rawResponse: data
      }
    }

    // 解析状态
    const taskStatus = data.output?.task_status
    let status: VideoStatus = 'pending'
    
    if (taskStatus === 'RUNNING') {
      status = 'processing'
    } else if (taskStatus === 'SUCCEEDED') {
      status = 'completed'
    } else if (taskStatus === 'FAILED') {
      status = 'failed'
    }

    return {
      taskId,
      status,
      videoUrl: data.output?.video_url,
      coverUrl: data.output?.cover_url,
      duration: data.output?.duration,
      error: data.output?.message,
      rawResponse: data
    }
  } catch (error) {
    console.error('[Wan视频状态查询] 异常:', error)
    return {
      taskId,
      status: 'failed',
      error: error instanceof Error ? error.message : '查询异常'
    }
  }
}

// ===================== 统一入口 =====================

/**
 * 视频生成统一入口
 */
export async function generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
  console.log('[视频生成] 引擎:', req.engine)
  
  if (req.engine === 'doubao') {
    return generateWithDoubao(req)
  } else if (req.engine === 'wan') {
    return generateWithWan(req)
  } else {
    return {
      taskId: '',
      status: 'failed',
      error: `不支持的视频生成引擎: ${req.engine}`
    }
  }
}

/**
 * 查询视频生成状态统一入口
 */
export async function getVideoStatus(engine: VideoEngine, taskId: string): Promise<VideoStatusResult> {
  if (engine === 'doubao') {
    return getDoubaoVideoStatus(taskId)
  } else if (engine === 'wan') {
    return getWanVideoStatus(taskId)
  } else {
    return {
      taskId,
      status: 'failed',
      error: `不支持的视频生成引擎: ${engine}`
    }
  }
}

/**
 * 检查视频生成服务配置状态
 */
export function checkVideoServiceConfig(): { doubao: boolean; wan: boolean } {
  return {
    doubao: !!(VOLCENGINE_ACCESS_KEY && VOLCENGINE_SECRET_KEY),
    wan: !!DASHSCOPE_API_KEY
  }
}
