
import React, { useState, useEffect } from 'react'
import { Navbar } from './components/Navbar'
import { LiveDashboardPreview } from './components/LiveDashboardPreview'
import { StudentGuideView } from './components/StudentGuideView'
import { HistoryView } from './components/HistoryView'
import { JsonViewerModal } from './components/JsonViewerModal'
import {
  fetchBackendStatus,
  loadPluginData,
  runNormalize,
  runPreprocess,
  runClassify,
  runGenerateLayout,
  getDownloadPageUrl
} from './services/api'
import { BackendStatus } from './types'
import {
  AlertCircle,
  CheckCircle2,
  X,
  Upload,
  Play,
  Download,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronRight,
  Search
} from 'lucide-react'

type StageStatus = 'pending' | 'in_progress' | 'completed' | 'error'

const getCandidates = (result: any): any[] => {
  return (
    result?.normalizedJson?.candidates ??
    result?.normalized_json?.candidates ??
    result?.normalized?.candidates ??
    result?.candidates ??
    result?.normalization?.candidates ??
    []
  )
}

const getPredictions = (result: any): any[] => {
  return (
    result?.classifierJson?.predictions ??
    result?.classifier_json?.predictions ??
    result?.classifier?.predictions ??
    result?.predictions ??
    result?.classification?.predictions ??
    []
  )
}

const getCandidateId = (item: any, index: number) =>
  String(
    item?.candidate_id ??
    item?.candidateId ??
    item?.id ??
    item?.node_id ??
    item?.nodeId ??
    index
  )

const getPredictionForCandidate = (candidate: any, predictions: any[], index: number) => {
  const candidateId = getCandidateId(candidate, index)

  return predictions.find((prediction: any) => {
    const predictionId = String(
      prediction?.candidate_id ??
      prediction?.candidateId ??
      prediction?.id ??
      prediction?.node_id ??
      prediction?.nodeId ??
      ''
    )

    return predictionId === candidateId
  })
}

const ExtractedDataView: React.FC<{ result: any }> = ({ result }) => {
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const candidates = getCandidates(result)
  const predictions = getPredictions(result)

  const filteredCandidates = candidates.filter((candidate, index) => {
    const prediction = getPredictionForCandidate(candidate, predictions, index)

    const searchText = [
      candidate?.name,
      candidate?.type,
      candidate?.candidate_id,
      candidate?.parent_id,
      prediction?.predicted_type,
      prediction?.class_name,
      prediction?.label
    ].join(' ').toLowerCase()

    const matchesSearch = searchText.includes(search.toLowerCase())

    const predictedType =
      prediction?.predicted_type ??
      prediction?.class_name ??
      prediction?.label ??
      'Unknown'

    const matchesType =
      selectedType === 'all' ||
      String(predictedType).toLowerCase() === selectedType.toLowerCase()

    return matchesSearch && matchesType
  })

  const predictionTypes = Array.from(
    new Set(
      predictions.map((prediction: any) =>
        String(
          prediction?.predicted_type ??
          prediction?.class_name ??
          prediction?.label ??
          'Unknown'
        )
      )
    )
  )

  const getValue = (value: any) => {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const metadataFields = [
    'candidate_id',
    'parent_id',
    'name',
    'type',
    'x',
    'y',
    'width',
    'height',
    'area',
    'aspect_ratio',
    'child_count',
    'text_count',
    'numeric_text_count',
    'vector_count',
    'line_count',
    'ellipse_count',
    'rectangle_count',
    'graphical_count',
    'candidate_score',
    'has_percentage',
    'has_date',
    'has_chart',
    'has_table',
    'has_kpi',
    'has_filter',
    'text_preview'
  ]

  const nodeCount =
    result?.nodeCount ??
    result?.node_count ??
    result?.sourceDimensions?.nodeCount ??
    result?.source_node_count ??
    '—'

  const executionTime =
    result?.executionTimeMs ??
    result?.execution_time_ms ??
    '—'

  return (
    <div className="mt-8 border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-6 bg-slate-50 border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              Extracted Component Data
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Inspect the candidates extracted from your Figma design and their XGBoost predictions.
            </p>
          </div>
          <button
            onClick={() =>
              setExpanded(expanded === 'all' ? null : 'all')
            }
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {expanded === 'all' ? 'Collapse all' : 'Expand first candidate'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-2xl font-bold text-slate-800">{nodeCount}</p>
            <p className="text-xs text-slate-500 mt-1">Source nodes</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-2xl font-bold text-slate-800">{candidates.length}</p>
            <p className="text-xs text-slate-500 mt-1">Extracted candidates</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-2xl font-bold text-slate-800">{predictions.length}</p>
            <p className="text-xs text-slate-500 mt-1">XGBoost predictions</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-2xl font-bold text-slate-800">
              {executionTime === '—' ? '—' : `${executionTime} ms`}
            </p>
            <p className="text-xs text-slate-500 mt-1">Execution time</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search candidate name, ID or predicted class..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedType}
            onChange={event => setSelectedType(event.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white"
          >
            <option value="all">All predicted classes</option>
            {predictionTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {candidates.length === 0 ? (
          <div className="p-8 text-center bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
            <h4 className="font-semibold text-amber-900">
              No candidate data found in the API response
            </h4>
            <p className="text-sm text-amber-800 mt-2">
              The layout response may not include normalizedJson.candidates.
              Check the API response and services/api.ts.
            </p>
            <p className="text-xs text-amber-700 mt-2">
              The extraction files may still exist on the backend; this message means the frontend did not receive the candidate array.
            </p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">
            No candidates match your search.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredCandidates.map(candidate => {
              const originalIndex = candidates.indexOf(candidate)
              const candidateId = getCandidateId(candidate, originalIndex)
              const prediction = getPredictionForCandidate(
                candidate,
                predictions,
                originalIndex
              )

              const predictedType =
                prediction?.predicted_type ??
                prediction?.class_name ??
                prediction?.label ??
                'Not available'

              const confidence =
                prediction?.confidence ??
                prediction?.probability ??
                prediction?.score

              const isExpanded =
                expanded === 'all' || expanded === candidateId

              return (
                <div
                  key={candidateId}
                  className="border border-slate-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpanded(isExpanded ? null : candidateId)
                    }
                    className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                      )}

                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">
                          {candidate?.name ?? candidate?.type ?? `Candidate ${originalIndex + 1}`}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          ID: {candidateId}
                          {' · '}
                          Type: {candidate?.type ?? 'Unknown'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        {predictedType}
                      </span>
                      {confidence !== undefined && (
                        <span className="text-xs text-slate-500">
                          {Number(confidence) <= 1
                            ? `${(Number(confidence) * 100).toFixed(1)}%`
                            : `${Number(confidence).toFixed(1)}%`}
                        </span>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-200 p-4 bg-white">
                      <h4 className="font-semibold text-sm text-slate-700 mb-3">
                        Extracted Features
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {metadataFields.map(field => (
                          <div
                            key={field}
                            className="bg-slate-50 rounded-md p-3 min-w-0"
                          >
                            <p className="text-xs text-slate-500 mb-1">
                              {field.replace(/_/g, ' ')}
                            </p>
                            <p className="text-sm text-slate-800 font-medium break-words">
                              {getValue(candidate?.[field])}
                            </p>
                          </div>
                        ))}
                      </div>

                      {prediction && (
                        <div className="mt-5">
                          <h4 className="font-semibold text-sm text-slate-700 mb-2">
                            XGBoost Prediction
                          </h4>
                          <pre className="text-xs bg-slate-900 text-emerald-300 p-4 rounded-lg overflow-auto max-h-64">
                            {JSON.stringify(prediction, null, 2)}
                          </pre>
                        </div>
                      )}

                      <div className="mt-5">
                        <h4 className="font-semibold text-sm text-slate-700 mb-2">
                          Complete Candidate JSON
                        </h4>
                        <pre className="text-xs bg-slate-900 text-slate-200 p-4 rounded-lg overflow-auto max-h-96">
                          {JSON.stringify(candidate, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => {
              const blob = new Blob(
                [JSON.stringify(candidates, null, 2)],
                { type: 'application/json' }
              )
              const url = URL.createObjectURL(blob)
              const anchor = document.createElement('a')
              anchor.href = url
              anchor.download = 'extracted_candidates.json'
              anchor.click()
              URL.revokeObjectURL(url)
            }}
            disabled={candidates.length === 0}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download className="w-4 h-4 inline mr-2" />
            Download Candidates
          </button>

          <button
            onClick={() => {
              const blob = new Blob(
                [JSON.stringify(predictions, null, 2)],
                { type: 'application/json' }
              )
              const url = URL.createObjectURL(blob)
              const anchor = document.createElement('a')
              anchor.href = url
              anchor.download = 'xgboost_predictions.json'
              anchor.click()
              URL.revokeObjectURL(url)
            }}
            disabled={predictions.length === 0}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download className="w-4 h-4 inline mr-2" />
            Download Predictions
          </button>
        </div>
      </div>
    </div>
  )
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'workspace' | 'preview' | 'guide' | 'history'>('workspace')
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null)
  const [isConnecting, setIsConnecting] = useState(true)

  const [stageStatus, setStageStatus] = useState<Record<string, StageStatus>>({
    plugin_received: 'pending',
    normalize: 'pending',
    preprocess: 'pending',
    classify: 'pending',
    layout: 'pending'
  })

  const [currentResult, setCurrentResult] = useState<any>(null)
  const [currentFigmaJson, setCurrentFigmaJson] = useState<any>(null)
  const [designName, setDesignName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [processingStage, setProcessingStage] = useState('')

  const [notification, setNotification] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const [jsonModalOpen, setJsonModalOpen] = useState(false)
  const [jsonModalData, setJsonModalData] = useState<any>(null)
  const [jsonModalTitle, setJsonModalTitle] = useState('')
  const [jsonModalFilename, setJsonModalFilename] = useState('')

  const showNotification = (
    message: string,
    type: 'success' | 'error' = 'success'
  ) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsConnecting(true)
        const status = await fetchBackendStatus()
        setBackendStatus(status)

        if (status.pluginDataReceived) {
          setStageStatus(prev => ({
            ...prev,
            plugin_received: 'completed'
          }))
          setDesignName(status.designName || 'Unknown Design')
        }
      } catch (err: any) {
        console.error('Backend connection failed:', err)
        showNotification(
          'Could not connect to FastAPI backend. Ensure server.py is running.',
          'error'
        )
      } finally {
        setIsConnecting(false)
      }
    }

    initialize()
  }, [])

  const handleLoadPluginData = async () => {
    setIsLoading(true)
    setProcessingStage('Loading design from Figma plugin...')

    try {
      const data = await loadPluginData()

      setCurrentFigmaJson(data.figmaJson)
      setDesignName(data.documentName)
      setCurrentResult(null)

      setStageStatus({
        plugin_received: 'completed',
        normalize: 'pending',
        preprocess: 'pending',
        classify: 'pending',
        layout: 'pending'
      })

      showNotification(`Loaded design: ${data.documentName}`)
    } catch (err: any) {
      showNotification(err.message || 'Failed to load plugin data', 'error')
      setStageStatus(prev => ({
        ...prev,
        plugin_received: 'error'
      }))
    } finally {
      setIsLoading(false)
      setProcessingStage('')
    }
  }

  const handleNormalize = async () => {
    if (!currentFigmaJson) {
      showNotification('Load Figma plugin data first.', 'error')
      return
    }

    setIsLoading(true)
    setProcessingStage('Normalizing design data...')
    setStageStatus(prev => ({ ...prev, normalize: 'in_progress' }))

    try {
      const normRes = await runNormalize({ figmaJson: currentFigmaJson })

      console.log('NORMALIZATION RESPONSE:', normRes)

      setStageStatus(prev => ({ ...prev, normalize: 'completed' }))
      setDesignName(normRes.documentName || designName)

      showNotification(
        `Normalized ${normRes.candidateCount ?? 'the'} component candidates`
      )
    } catch (err: any) {
      setStageStatus(prev => ({ ...prev, normalize: 'error' }))
      showNotification(err.message || 'Normalization failed', 'error')
    } finally {
      setIsLoading(false)
      setProcessingStage('')
    }
  }

  const handlePreprocess = async () => {
    if (!currentFigmaJson) {
      showNotification('Load Figma plugin data first.', 'error')
      return
    }

    setIsLoading(true)
    setProcessingStage('Extracting features...')
    setStageStatus(prev => ({ ...prev, preprocess: 'in_progress' }))

    try {
      const prepRes = await runPreprocess({ figmaJson: currentFigmaJson })

      console.log('PREPROCESS RESPONSE:', prepRes)

      setStageStatus(prev => ({ ...prev, preprocess: 'completed' }))
      showNotification(
        `Extracted features for ${prepRes.candidateCount ?? 'the'} components`
      )
    } catch (err: any) {
      setStageStatus(prev => ({ ...prev, preprocess: 'error' }))
      showNotification(err.message || 'Preprocessing failed', 'error')
    } finally {
      setIsLoading(false)
      setProcessingStage('')
    }
  }

  const handleClassify = async () => {
    if (!currentFigmaJson) {
      showNotification('Load Figma plugin data first.', 'error')
      return
    }

    setIsLoading(true)
    setProcessingStage('Running XGBoost model...')
    setStageStatus(prev => ({ ...prev, classify: 'in_progress' }))

    try {
      const classRes = await runClassify({ figmaJson: currentFigmaJson })

      console.log('XGBOOST CLASSIFICATION RESPONSE:', classRes)

      setStageStatus(prev => ({ ...prev, classify: 'completed' }))
      showNotification(
        `Classified ${classRes.candidateCount ?? 'the'} components with XGBoost`
      )
    } catch (err: any) {
      setStageStatus(prev => ({ ...prev, classify: 'error' }))
      showNotification(err.message || 'Classification failed', 'error')
    } finally {
      setIsLoading(false)
      setProcessingStage('')
    }
  }

  const handleGenerateLayout = async () => {
    if (!currentFigmaJson) {
      showNotification('Load Figma plugin data first.', 'error')
      return
    }

    setIsLoading(true)
    setProcessingStage('Generating 12x12 grid layout...')
    setStageStatus(prev => ({ ...prev, layout: 'in_progress' }))

    try {
      const layoutRes: any = await runGenerateLayout({
        figmaJson: currentFigmaJson
      })

      console.log('COMPLETE LAYOUT API RESPONSE:', layoutRes)
      console.log('EXTRACTED CANDIDATES:', getCandidates(layoutRes))
      console.log('XGBOOST PREDICTIONS:', getPredictions(layoutRes))

      // Keep the complete API response.
      // Do not manually rebuild the object and discard extraction metadata.
      setCurrentResult(layoutRes)

      setStageStatus(prev => ({ ...prev, layout: 'completed' }))

      if (layoutRes?.pageJson?.title) {
        setDesignName(layoutRes.pageJson.title)
      }

      showNotification(
        `Generated dashboard with ${layoutRes?.stats?.widgets ?? 0} widgets`
      )
    } catch (err: any) {
      console.error('LAYOUT GENERATION ERROR:', err)
      setStageStatus(prev => ({ ...prev, layout: 'error' }))
      showNotification(err.message || 'Layout generation failed', 'error')
    } finally {
      setIsLoading(false)
      setProcessingStage('')
    }
  }

  const handleDownload = () => {
    window.open(getDownloadPageUrl(), '_blank')
  }

  const handleViewJson = (
    jsonData: any,
    title: string,
    filename: string
  ) => {
    setJsonModalData(jsonData)
    setJsonModalTitle(title)
    setJsonModalFilename(filename)
    setJsonModalOpen(true)
  }

  const handleJsonModalDownload = () => {
    const jsonString = JSON.stringify(jsonModalData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = jsonModalFilename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  const canRunStage = (stage: string) => {
    if (stage === 'normalize') {
      return stageStatus.plugin_received === 'completed'
    }
    if (stage === 'preprocess') {
      return stageStatus.normalize === 'completed'
    }
    if (stage === 'classify') {
      return stageStatus.preprocess === 'completed'
    }
    if (stage === 'layout') {
      return stageStatus.classify === 'completed'
    }
    return false
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        status={backendStatus}
        isConnecting={isConnecting}
        onAddDesign={() => {}}
      />

      {notification && (
        <div className="fixed top-16 right-6 z-50 animate-in slide-in-from-top-2 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              notification.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}

            <span>{notification.message}</span>

            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 pb-16">
        {activeTab === 'workspace' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Design reception */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">
                  Design Reception
                </h2>

                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                    stageStatus.plugin_received === 'completed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : stageStatus.plugin_received === 'error'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {stageStatus.plugin_received === 'completed' && (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {stageStatus.plugin_received === 'error' && (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {stageStatus.plugin_received === 'completed'
                    ? 'Design received'
                    : stageStatus.plugin_received === 'error'
                    ? 'Error'
                    : 'Waiting for plugin'}
                </div>
              </div>

              {designName && (
                <p className="text-sm text-slate-600 mb-4">
                  Current design:{' '}
                  <span className="font-medium">{designName}</span>
                </p>
              )}

              <button
                onClick={handleLoadPluginData}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                <Upload className="w-4 h-4" />
                Load / Reload Plugin Data
              </button>

              {stageStatus.plugin_received === 'pending' && (
                <p className="text-xs text-slate-500 mt-2">
                  Send a design from the Figma plugin first.
                </p>
              )}
            </div>

            {/* Processing pipeline */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-6">
                Processing Pipeline
              </h2>

              <div className="space-y-4">
                {[
                  {
                    key: 'normalize',
                    number: 1,
                    title: 'Normalize',
                    description: 'Extract component candidates',
                    action: handleNormalize
                  },
                  {
                    key: 'preprocess',
                    number: 2,
                    title: 'Preprocess',
                    description: 'Extract features for ML model',
                    action: handlePreprocess
                  },
                  {
                    key: 'classify',
                    number: 3,
                    title: 'Run Model',
                    description: 'XGBoost classification',
                    action: handleClassify
                  },
                  {
                    key: 'layout',
                    number: 4,
                    title: 'Generate Layout',
                    description: '12x12 grid and Vista page.json',
                    action: handleGenerateLayout
                  }
                ].map(stage => {
                  const status = stageStatus[stage.key]
                  const enabled = canRunStage(stage.key) && !isLoading

                  return (
                    <div
                      key={stage.key}
                      className="flex items-center justify-between p-4 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            status === 'completed'
                              ? 'bg-emerald-100 text-emerald-600'
                              : status === 'in_progress'
                              ? 'bg-blue-100 text-blue-600'
                              : status === 'error'
                              ? 'bg-rose-100 text-rose-600'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : status === 'in_progress' ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : status === 'error' ? (
                            <AlertCircle className="w-4 h-4" />
                          ) : (
                            <span className="text-sm font-medium">
                              {stage.number}
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="font-medium text-slate-800">
                            {stage.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {stage.description}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={stage.action}
                        disabled={!enabled}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          enabled
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Play className="w-4 h-4" />
                        Run
                      </button>
                    </div>
                  )
                })}
              </div>

              {processingStage && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {processingStage}
                  </div>
                </div>
              )}
            </div>

            {/* Results */}
            {currentResult && (
              <>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h2 className="text-lg font-semibold text-slate-800">
                      Generated Dashboard
                    </h2>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          handleViewJson(
                            currentResult,
                            'Complete Pipeline Response',
                            'pipeline_response.json'
                          )
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"
                      >
                        <Eye className="w-4 h-4 text-slate-600" />
                        View Complete JSON
                      </button>

                      <button
                        onClick={() =>
                          handleViewJson(
                            currentResult.pageJson,
                            'Vista page.json',
                            'page.json'
                          )
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"
                      >
                        <Eye className="w-4 h-4 text-slate-600" />
                        View page.json
                      </button>

                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900"
                      >
                        <Download className="w-4 h-4" />
                        Download page.json
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-2xl font-bold text-slate-800">
                        {currentResult?.stats?.widgets ?? 0}
                      </p>
                      <p className="text-xs text-slate-500">Widgets</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-2xl font-bold text-slate-800">
                        {currentResult?.stats?.tiles ?? 0}
                      </p>
                      <p className="text-xs text-slate-500">Tiles</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-2xl font-bold text-slate-800">
                        {currentResult?.stats?.needAttention ?? 0}
                      </p>
                      <p className="text-xs text-slate-500">Need Review</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('preview')}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    View Dashboard Preview
                  </button>
                </div>

                {/* Extracted data and model predictions */}
                <ExtractedDataView result={currentResult} />
              </>
            )}
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LiveDashboardPreview
              pageJson={currentResult?.pageJson || null}
              onRefresh={handleGenerateLayout}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <HistoryView />
          </div>
        )}

        {activeTab === 'guide' && <StudentGuideView />}
      </main>

      <JsonViewerModal
        isOpen={jsonModalOpen}
        onClose={() => setJsonModalOpen(false)}
        title={jsonModalTitle}
        jsonData={jsonModalData}
        onDownload={handleJsonModalDownload}
        downloadFilename={jsonModalFilename}
      />
    </div>
  )
}

export default App
