import {
    getDBOperator,
    ProgressTypes,
    PlayerTypes,
    reduxStore,
    fmp,
    isSnapshot,
    classifyRecords,
    isDev,
    radix64
} from '@timecat/utils'
import { ContainerComponent } from './container'
import { Panel } from './panel'
import pako from 'pako'
import { SnapshotData, ReplayOptions, RecordData, RecorderOptions, ReplayData } from '@timecat/share'
import { waitStart, removeStartPage, showStartMask } from './dom'
import smoothScroll from 'smoothscroll-polyfill'

const defaultReplayOptions = { autoplay: true, mode: 'default' } as ReplayOptions

export async function replay(options: ReplayOptions) {
    options = Object.assign(defaultReplayOptions, options)

    window.__ReplayOptions__ = options
    smoothScroll.polyfill()

    const replayData = await getReplayData(options)

    if (!replayData) {
        throw new Error(
            'window.__ReplayDataList__ not found, you should inject to the global or DB, see demos: https://oct16.github.io/TimeCat'
        )
    }

    const { records, audio } = replayData
    const hasAudio = audio && (audio.src || audio.bufferStrList.length)

    const c = new ContainerComponent()
    new Panel(c)

    showStartMask()

    fmp.ready(async () => {
        if (hasAudio) {
            await waitStart()
        }
        removeStartPage()

        if (records.length) {
            const firstRecord = records[0]

            const replayList = window.__ReplayDataList__
            const startTime = firstRecord.time
            const endTime =
                replayList
                    .map(r => r.records)
                    .reduce((acc, records) => {
                        return acc + (+records.slice(-1)[0].time - +records[0].time)
                    }, 0) + +startTime

            reduxStore.dispatch({
                type: ProgressTypes.INFO,
                data: {
                    frame: 0,
                    curTime: Number(startTime),
                    startTime: Number(startTime),
                    endTime,
                    length: records.length
                }
            })

            if (options.autoplay || hasAudio) {
                reduxStore.dispatch({
                    type: PlayerTypes.SPEED,
                    data: { speed: 1 }
                })
            }
        }
    })

    if (!records.length) {
        const panel = document.querySelector('#cat-panel')
        if (panel) {
            panel.setAttribute('style', 'display: none')
        }
    }
}

function getGZipData() {
    if (isDev) {
        ;(window as any).pako = pako
    }
    const data = window.__ReplayStrData__
    if (!data) {
        return null
    }

    const codeArray: number[] = []
    const strArray = data.split('')
    for (let i = 0; i < strArray.length; i++) {
        const num = strArray[i].charCodeAt(0)
        codeArray.push(num >= 300 ? num - 300 : num)
    }

    const str = pako.ungzip(codeArray, {
        to: 'string'
    })
    const replayDataList = JSON.parse(str) as ReplayData[]

    if (isDev) {
        ;(window as any).data = replayDataList
    }
    return replayDataList
}

function dispatchEvent(type: string, data: RecordData) {
    event = new CustomEvent(type, { detail: data })
    window.dispatchEvent(event)
}

async function dataReceiver(
    receiver: (sender: (data: SnapshotData | RecordData) => void) => void
): Promise<ReplayData[]> {
    return await new Promise(resolve => {
        let initialized = false
        receiver(data => {
            if (initialized) {
                dispatchEvent('record-data', data as RecordData)
            } else {
                if (data && isSnapshot(data)) {
                    resolve([
                        {
                            snapshot: data as SnapshotData,
                            records: [],
                            audio: { src: '', bufferStrList: [], subtitles: [], opts: {} as RecorderOptions }
                        }
                    ])
                    fmp.observe()
                    initialized = true
                }
            }
        })
    })
}

async function getDataFromDB() {
    const DBOperator = await getDBOperator
    const data = await DBOperator.readAllRecords()

    if (data) {
        return classifyRecords(data)
    }

    return null
}

async function getReplayData(options: ReplayOptions) {
    const { receiver } = options

    const rawReplayDataList =
        options.replayDataList ||
        (receiver && (await dataReceiver(receiver))) ||
        getGZipData() ||
        (await getDataFromDB()) ||
        window.__ReplayDataList__

    const replayDataList = decodeDataList(rawReplayDataList)

    if (replayDataList) {
        window.__ReplayDataList__ = replayDataList
        window.__ReplayData__ = Object.assign(
            {
                index: 0
            },
            replayDataList[0]
        )
        return window.__ReplayData__
    }
    return null
}

function decodeDataList(list: ReplayData[]): ReplayData[] {
    const { atob } = radix64
    list.forEach(data => {
        const { records, snapshot } = data
        snapshot.time = snapshot.time.length < 8 ? atob.call(radix64, snapshot.time) + '' : snapshot.time
        records.forEach(record => {
            record.time = record.time.length < 8 ? atob.call(radix64, record.time) + '' : record.time
        })
    })
    return list
}
