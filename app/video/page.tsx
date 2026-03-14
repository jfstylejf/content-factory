'use client'

import { useState, useEffect } from 'react'
import { 
  Video, 
  Sparkles, 
  Play, 
  Pause, 
  RefreshCw, 
  Upload, 
  Send,
  Clock,
  Settings,
  FileText,
  Image,
  Film,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Mic
} from 'lucide-react'

// 类型定义
type GenerationType = 'text2video' | 'image2video' | 'video2video' | 'digital_human'
type VideoEngine = 'doubao' | 'wan' | 'duix' | 'tencent' | 'heygen' | 'd-id'
type DigitalHumanMode = 'text2avatar' | 'audio2avatar'
type AspectRatio = '9:16' | '16:9' | '1:1'
type VideoStatus = 'draft' | 'generating' | 'generated' | 'publishing' | 'published' | 'failed'

interface VideoData {
  id?: number
  title: string
  description: string
  idea: string
  script: string
  prompt: string
  generationType: GenerationType
  engine: VideoEngine
  duration: number
  aspectRatio: AspectRatio
  resolution: string
  style: string
  sourceImage: string
  sourceVideo: string
  videoUrl: string
  coverUrl: string
  status: VideoStatus
  taskId: string
  tags: string[]
  // 数字人相关字段
  digitalHumanMode: DigitalHumanMode
  broadcastText: string
  audioUrl: string
  avatarId: string
  voiceId: string
}

// 初始状态
const initialVideoData: VideoData = {
  title: '',
  description: '',
  idea: '',
  script: '',
  prompt: '',
  generationType: 'text2video',
  engine: 'doubao',
  duration: 5,
  aspectRatio: '9:16',
  resolution: '1080p',
  style: '',
  sourceImage: '',
  sourceVideo: '',
  videoUrl: '',
  coverUrl: '',
  status: 'draft',
  taskId: '',
  tags: [],
  // 数字人相关
  digitalHumanMode: 'text2avatar',
  broadcastText: '',
  audioUrl: '',
  avatarId: '',
  voiceId: ''
}

export default function VideoCreatePage() {
  const [videoData, setVideoData] = useState<VideoData>(initialVideoData)
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [pollingStatus, setPollingStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 生成视频脚本
  const handleGenerateScript = async () => {
    if (!videoData.idea.trim()) {
      setError('请输入你的创意想法')
      return
    }

    setIsGeneratingScript(true)
    setError(null)

    try {
      const response = await fetch('/api/video/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: videoData.idea,
          generationType: videoData.generationType,
          duration: videoData.duration,
          aspectRatio: videoData.aspectRatio,
          style: videoData.style
        })
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || '生成脚本失败')
        return
      }

      setVideoData(prev => ({
        ...prev,
        title: data.data.title,
        description: data.data.description,
        script: data.data.script,
        prompt: data.data.prompt,
        tags: data.data.tags || []
      }))

      setSuccess('脚本生成成功！')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('生成脚本时发生错误')
    } finally {
      setIsGeneratingScript(false)
    }
  }

  // 生成视频
  const handleGenerateVideo = async () => {
    // 数字人模式的验证
    if (videoData.generationType === 'digital_human') {
      if (videoData.digitalHumanMode === 'text2avatar' && !videoData.broadcastText.trim()) {
        setError('请输入播报文本')
        return
      }
      if (videoData.digitalHumanMode === 'audio2avatar' && !videoData.audioUrl.trim()) {
        setError('请输入音频 URL')
        return
      }
    } else {
      // 普通视频生成模式的验证
      if (!videoData.prompt.trim()) {
        setError('请先生成或输入视频提示词')
        return
      }
    }

    setIsGeneratingVideo(true)
    setError(null)

    try {
      // 先保存视频草稿
      let videoId = videoData.id
      if (!videoId) {
        const saveResponse = await fetch('/api/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: videoData.title || '未命名视频',
            description: videoData.description,
            idea: videoData.idea,
            script: videoData.script,
            prompt: videoData.prompt,
            generationType: videoData.generationType,
            engine: videoData.engine,
            duration: videoData.duration,
            aspectRatio: videoData.aspectRatio,
            resolution: videoData.resolution,
            style: videoData.style,
            sourceImage: videoData.sourceImage,
            sourceVideo: videoData.sourceVideo,
            // 数字人相关字段
            digitalHumanMode: videoData.digitalHumanMode,
            broadcastText: videoData.broadcastText,
            audioUrl: videoData.audioUrl,
            avatarId: videoData.avatarId,
            voiceId: videoData.voiceId
          })
        })

        const saveData = await saveResponse.json()
        if (!saveData.success) {
          setError(saveData.error || '保存视频失败')
          setIsGeneratingVideo(false)
          return
        }
        videoId = saveData.data.id
        setVideoData(prev => ({ ...prev, id: videoId }))
      }

      // 根据生成类型调用不同API
      let generateUrl = '/api/video/generate'
      let requestBody: any = {
        videoId,
        prompt: videoData.prompt,
        generationType: videoData.generationType,
        engine: videoData.engine,
        duration: videoData.duration,
        aspectRatio: videoData.aspectRatio,
        resolution: videoData.resolution,
        style: videoData.style,
        sourceImage: videoData.sourceImage,
        sourceVideo: videoData.sourceVideo
      }

      // 数字人生成使用专用API
      if (videoData.generationType === 'digital_human') {
        generateUrl = '/api/video/digital-human'
        requestBody = {
          videoId,
          engine: videoData.engine,
          mode: videoData.digitalHumanMode,
          text: videoData.broadcastText,
          audioUrl: videoData.audioUrl,
          avatarId: videoData.avatarId,
          voiceId: videoData.voiceId,
          aspectRatio: videoData.aspectRatio,
          resolution: videoData.resolution
        }
      }

      const response = await fetch(generateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || '视频生成失败')
        setIsGeneratingVideo(false)
        return
      }

      setVideoData(prev => ({
        ...prev,
        taskId: data.data.taskId,
        status: 'generating'
      }))

      setSuccess('视频生成任务已创建，正在生成中...')
      setPollingStatus(true)
    } catch (err) {
      setError('生成视频时发生错误')
      setIsGeneratingVideo(false)
    }
  }

  // 轮询视频状态
  useEffect(() => {
    if (!pollingStatus || !videoData.taskId || !videoData.engine) return

    const pollInterval = setInterval(async () => {
      try {
        // 根据生成类型选择不同的状态查询API
        let statusUrl = `/api/video/status?taskId=${videoData.taskId}&engine=${videoData.engine}&videoId=${videoData.id}`
        
        if (videoData.generationType === 'digital_human') {
          statusUrl = `/api/video/digital-human?action=status&taskId=${videoData.taskId}&engine=${videoData.engine}`
        }
        
        const response = await fetch(statusUrl)
        const data = await response.json()

        if (data.success) {
          if (data.data.status === 'completed') {
            setVideoData(prev => ({
              ...prev,
              videoUrl: data.data.videoUrl || '',
              coverUrl: data.data.coverUrl || '',
              duration: data.data.duration || prev.duration,
              status: 'generated'
            }))
            setPollingStatus(false)
            setIsGeneratingVideo(false)
            setSuccess('视频生成完成！')
            setTimeout(() => setSuccess(null), 3000)
          } else if (data.data.status === 'failed') {
            setVideoData(prev => ({ ...prev, status: 'failed' }))
            setPollingStatus(false)
            setIsGeneratingVideo(false)
            setError(data.data.error || '视频生成失败')
          }
        }
      } catch (err) {
        console.error('轮询状态失败:', err)
      }
    }, 5000) // 每5秒轮询一次

    return () => clearInterval(pollInterval)
  }, [pollingStatus, videoData.taskId, videoData.engine, videoData.id, videoData.generationType])

  // 重置
  const handleReset = () => {
    setVideoData(initialVideoData)
    setError(null)
    setSuccess(null)
    setIsGeneratingScript(false)
    setIsGeneratingVideo(false)
    setPollingStatus(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 lg:p-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Video className="w-8 h-8 text-blue-600" />
          视频创作
        </h1>
        <p className="text-gray-600 mt-2">
          基于AI智能生成高质量视频，一键发布多平台
        </p>
      </div>

      {/* 提示信息 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <XCircle className="w-5 h-5" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：创意输入和参数设置 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 创意输入 */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              创意输入
            </h2>
            <textarea
              value={videoData.idea}
              onChange={(e) => setVideoData(prev => ({ ...prev, idea: e.target.value }))}
              placeholder="请输入你的创意想法，例如：我想做一个关于AI改变生活的短视频，展示早起、工作、学习三个场景，体现科技感和未来感..."
              className="w-full h-32 px-4 py-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 生成参数 */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-gray-500" />
              生成参数
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 生成类型 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">生成类型</label>
                <select
                  value={videoData.generationType}
                  onChange={(e) => setVideoData(prev => ({ ...prev, generationType: e.target.value as GenerationType }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="text2video">🎬 文生视频</option>
                  <option value="image2video">🖼️ 图生视频</option>
                  <option value="video2video">🎞️ 视频续写</option>
                  <option value="digital_human">🧑‍💻 数字人口播</option>
                </select>
              </div>

              {/* 视频引擎 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {videoData.generationType === 'digital_human' ? '数字人引擎' : '视频引擎'}
                </label>
                <select
                  value={videoData.engine}
                  onChange={(e) => setVideoData(prev => ({ ...prev, engine: e.target.value as VideoEngine }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {videoData.generationType === 'digital_human' ? (
                    <>
                      <option value="duix">硅基智能 DUIX（推荐）</option>
                      <option value="tencent">腾讯云智能数智人</option>
                      <option value="heygen">HeyGen（海外/多语言）</option>
                      <option value="d-id">D-ID（照片转视频）</option>
                    </>
                  ) : (
                    <>
                      <option value="doubao">豆包 Seedance 2.0</option>
                      <option value="wan">通义万相 Wan 2.6</option>
                    </>
                  )}
                </select>
              </div>

              {/* 视频比例 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">视频比例</label>
                <select
                  value={videoData.aspectRatio}
                  onChange={(e) => setVideoData(prev => ({ ...prev, aspectRatio: e.target.value as AspectRatio }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="9:16">9:16 竖屏</option>
                  <option value="16:9">16:9 横屏</option>
                  <option value="1:1">1:1 方形</option>
                </select>
              </div>

              {/* 视频时长 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">视频时长</label>
                <select
                  value={videoData.duration}
                  onChange={(e) => setVideoData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="5">5 秒</option>
                  <option value="10">10 秒</option>
                  <option value="15">15 秒</option>
                </select>
              </div>
            </div>

            {/* 风格输入 */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">视频风格（可选）</label>
              <input
                type="text"
                value={videoData.style}
                onChange={(e) => setVideoData(prev => ({ ...prev, style: e.target.value }))}
                placeholder="例如：科技感、电影质感、动漫风格、写实风格..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 图生视频的图片上传 */}
            {videoData.generationType === 'image2video' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">源图片 URL</label>
                <input
                  type="text"
                  value={videoData.sourceImage}
                  onChange={(e) => setVideoData(prev => ({ ...prev, sourceImage: e.target.value }))}
                  placeholder="输入图片 URL"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* 视频续写的视频上传 */}
            {videoData.generationType === 'video2video' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">源视频 URL</label>
                <input
                  type="text"
                  value={videoData.sourceVideo}
                  onChange={(e) => setVideoData(prev => ({ ...prev, sourceVideo: e.target.value }))}
                  placeholder="输入视频 URL"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* 数字人口播专属设置 */}
            {videoData.generationType === 'digital_human' && (
              <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-100">
                <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-purple-600" />
                  数字人设置
                </h3>

                {/* 生成模式 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">生成模式</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="digitalHumanMode"
                        value="text2avatar"
                        checked={videoData.digitalHumanMode === 'text2avatar'}
                        onChange={() => setVideoData(prev => ({ ...prev, digitalHumanMode: 'text2avatar' }))}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm">📝 文本口播</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="digitalHumanMode"
                        value="audio2avatar"
                        checked={videoData.digitalHumanMode === 'audio2avatar'}
                        onChange={() => setVideoData(prev => ({ ...prev, digitalHumanMode: 'audio2avatar' }))}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm">🎙️ 音频驱动</span>
                    </label>
                  </div>
                </div>

                {/* 文本口播模式 - 播报文本 */}
                {videoData.digitalHumanMode === 'text2avatar' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">播报文本</label>
                    <textarea
                      value={videoData.broadcastText}
                      onChange={(e) => setVideoData(prev => ({ ...prev, broadcastText: e.target.value }))}
                      placeholder="输入您希望数字人播报的文本内容..."
                      className="w-full h-32 px-3 py-2 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">已输入 {videoData.broadcastText.length} 字，建议控制在 500 字以内</p>
                  </div>
                )}

                {/* 音频驱动模式 - 音频URL */}
                {videoData.digitalHumanMode === 'audio2avatar' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Mic className="w-4 h-4 inline mr-1" />
                      音频 URL
                    </label>
                    <input
                      type="text"
                      value={videoData.audioUrl}
                      onChange={(e) => setVideoData(prev => ({ ...prev, audioUrl: e.target.value }))}
                      placeholder="输入音频文件 URL（支持 MP3, WAV 格式）"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">数字人将根据音频自动进行口型同步</p>
                  </div>
                )}

                {/* 数字人形象ID */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">数字人形象（可选）</label>
                  <input
                    type="text"
                    value={videoData.avatarId}
                    onChange={(e) => setVideoData(prev => ({ ...prev, avatarId: e.target.value }))}
                    placeholder="输入数字人形象ID，留空使用默认形象"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">可以在对应平台获取形象ID，或使用图片URL（D-ID）</p>
                </div>

                {/* 声音ID - 仅文本口播模式 */}
                {videoData.digitalHumanMode === 'text2avatar' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">声音选择（可选）</label>
                    <input
                      type="text"
                      value={videoData.voiceId}
                      onChange={(e) => setVideoData(prev => ({ ...prev, voiceId: e.target.value }))}
                      placeholder="输入声音ID，留空使用默认声音"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}

                {/* 引擎说明 */}
                <div className="p-3 bg-white/60 rounded-lg text-xs text-gray-600">
                  <p className="font-medium mb-1">💡 引擎说明:</p>
                  <ul className="space-y-1 text-gray-500">
                    <li>• <strong>硅基 DUIX</strong>: 国内首选，开源低成本，口型准确</li>
                    <li>• <strong>腾讯数智人</strong>: 企业级稳定，与视频号打通</li>
                    <li>• <strong>HeyGen</strong>: 海外首选，支持120+语言</li>
                    <li>• <strong>D-ID</strong>: 照片转视频，轻量快速</li>
                  </ul>
                </div>
              </div>
            )}

            {/* 生成脚本按钮 */}
            <div className="mt-6 flex gap-4">
              <button
                onClick={handleGenerateScript}
                disabled={isGeneratingScript || !videoData.idea.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-medium hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isGeneratingScript ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    生成视频脚本
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 数字人模式 - 直接生成按钮 */}
          {videoData.generationType === 'digital_human' && (
            <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-purple-500" />
                数字人视频生成
              </h2>
              
              {/* 视频标题 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">视频标题</label>
                <input
                  type="text"
                  value={videoData.title}
                  onChange={(e) => setVideoData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="给你的数字人视频起个名字..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* 视频描述 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">视频描述（可选）</label>
                <textarea
                  value={videoData.description}
                  onChange={(e) => setVideoData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="描述一下视频内容..."
                  className="w-full h-20 px-3 py-2 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* 生成按钮 */}
              <button
                onClick={handleGenerateVideo}
                disabled={
                  isGeneratingVideo || 
                  (videoData.digitalHumanMode === 'text2avatar' && !videoData.broadcastText.trim()) ||
                  (videoData.digitalHumanMode === 'audio2avatar' && !videoData.audioUrl.trim())
                }
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isGeneratingVideo ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {videoData.status === 'generating' ? '数字人生成中...' : '创建任务中...'}
                  </>
                ) : (
                  <>
                    <User className="w-5 h-5" />
                    生成数字人视频
                  </>
                )}
              </button>
            </div>
          )}

          {/* 普通视频模式 - 脚本预览 */}
          {videoData.generationType !== 'digital_human' && (videoData.script || videoData.prompt) && (
            <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-blue-500" />
                视频脚本
              </h2>
              
              {/* 标题 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">视频标题</label>
                <input
                  type="text"
                  value={videoData.title}
                  onChange={(e) => setVideoData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 描述 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">视频描述</label>
                <textarea
                  value={videoData.description}
                  onChange={(e) => setVideoData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full h-20 px-3 py-2 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 脚本 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">分镜脚本</label>
                <textarea
                  value={videoData.script}
                  onChange={(e) => setVideoData(prev => ({ ...prev, script: e.target.value }))}
                  className="w-full h-32 px-3 py-2 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              {/* 提示词 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">AI 视频提示词 (Prompt)</label>
                <textarea
                  value={videoData.prompt}
                  onChange={(e) => setVideoData(prev => ({ ...prev, prompt: e.target.value }))}
                  className="w-full h-24 px-3 py-2 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="英文提示词，描述视频画面内容、风格、镜头运动等..."
                />
              </div>

              {/* 标签 */}
              {videoData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {videoData.tags.map((tag, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 生成视频按钮 */}
              <div className="mt-6">
                <button
                  onClick={handleGenerateVideo}
                  disabled={isGeneratingVideo || !videoData.prompt.trim()}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isGeneratingVideo ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {videoData.status === 'generating' ? '视频生成中...' : '创建任务中...'}
                    </>
                  ) : (
                    <>
                      <Video className="w-5 h-5" />
                      开始生成视频
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 右侧：视频预览和发布 */}
        <div className="space-y-6">
          {/* 视频预览 */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Play className="w-5 h-5 text-green-500" />
              视频预览
            </h2>
            
            <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${
              videoData.aspectRatio === '9:16' ? 'aspect-[9/16]' : 
              videoData.aspectRatio === '16:9' ? 'aspect-video' : 'aspect-square'
            }`}>
              {videoData.videoUrl ? (
                <video
                  src={videoData.videoUrl}
                  poster={videoData.coverUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  {videoData.status === 'generating' ? (
                    <>
                      <Loader2 className="w-12 h-12 animate-spin mb-3" />
                      <p>视频生成中...</p>
                      <p className="text-sm text-gray-500 mt-1">请稍候，这可能需要几分钟</p>
                    </>
                  ) : (
                    <>
                      <Film className="w-12 h-12 mb-3" />
                      <p>暂无视频</p>
                      <p className="text-sm text-gray-500 mt-1">生成视频后将在此显示</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 状态信息 */}
            <div className="mt-4 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">状态:</span>
                <span className={`flex items-center gap-1 ${
                  videoData.status === 'generated' || videoData.status === 'published' ? 'text-green-600' :
                  videoData.status === 'generating' ? 'text-blue-600' :
                  videoData.status === 'failed' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {videoData.status === 'generated' && <CheckCircle className="w-4 h-4" />}
                  {videoData.status === 'generating' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {videoData.status === 'failed' && <XCircle className="w-4 h-4" />}
                  {videoData.status === 'draft' && '草稿'}
                  {videoData.status === 'generating' && '生成中'}
                  {videoData.status === 'generated' && '已生成'}
                  {videoData.status === 'publishing' && '发布中'}
                  {videoData.status === 'published' && '已发布'}
                  {videoData.status === 'failed' && '失败'}
                </span>
              </div>
              <div className="text-gray-500">
                时长: {videoData.duration}秒
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重置
              </button>
            </div>
          </div>

          {/* 发布设置 */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Send className="w-5 h-5 text-purple-500" />
              发布设置
            </h2>

            {/* 平台选择 */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                <span className="font-medium">小红书</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                <span className="font-medium">抖音</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                <span className="font-medium">视频号</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                <span className="font-medium">B站</span>
              </label>
            </div>

            {/* 定时发布 */}
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4" />
                定时发布
              </label>
              <input
                type="datetime-local"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 发布按钮 */}
            <button
              disabled={!videoData.videoUrl}
              className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-5 h-5" />
              一键发布
            </button>

            <p className="mt-3 text-xs text-gray-500 text-center">
              * 发布功能正在开发中，敬请期待
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
