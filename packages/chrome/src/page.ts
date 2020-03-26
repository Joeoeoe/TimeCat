let ctr: any

function record() {
    const wr = (window as any).wr
    const { DB, record } = wr

    DB.then((db: any) => {
        db.clear()
        ctr = record({
            emitter: (data: any) => {
                db.add(data)
            }
        })
    })
}

function replay() {
    const wr = (window as any).wr
    const scriptUrl =
        process.env.NODE_ENV === 'production'
            ? chrome.runtime.getURL('replay.min.js')
            : 'http://localhost:4321/replay.min.js'

    if (ctr) {
        wr.exportReplay({
            scripts: [scriptUrl],
            autoPlay: true
        })
        ctr.uninstall()
    }
}

window.addEventListener('CHROME_RECORD_START', () => record(), false)
window.addEventListener('CHROME_RECORD_FINISH', () => replay(), false)