import {
    nodeStore,
    SnapshotData,
    MouseSnapshotData,
    DOMObserveData,
    FormElementObserveData,
    SnapshotType,
    MouseEventType,
    DOMObserveMutations,
    ChildListUpdateData,
    CharacterDataUpdateData,
    AttributesUpdateData
} from '@WebReplay/snapshot'
import { Player } from './player'

export function execFrame(this: Player, snapshot: SnapshotData) {
    const { type, data } = snapshot
    switch (type) {
        case SnapshotType.MOUSE:
            const { x, y, type } = data as MouseSnapshotData
            if (type === MouseEventType.MOVE) {
                this.pointer.move(x, y)
            } else if (type === MouseEventType.CLICK) {
                this.pointer.click(x, y)
            }
            break
        case SnapshotType.DOM_UPDATE:
            const { mutations } = data as DOMObserveData
            mutations.forEach((mutate: DOMObserveMutations) => {
                const { mType, data } = mutate
                const { value, attr, type, parentId, nodeId } = data as ChildListUpdateData &
                    (CharacterDataUpdateData & AttributesUpdateData)
                switch (mType) {
                    case 'attributes':
                    case 'characterData':
                        const targetEl = nodeStore.getNode(nodeId) as HTMLElement
                        targetEl.setAttribute(attr, value)
                        break
                    case 'childList':
                        const parentNode = nodeStore.getNode(parentId) as HTMLElement
                        const targetNode = nodeStore.getNode(nodeId) as Element
                        if (type === 'delete') {
                            parentNode!.removeChild(parentNode.firstChild!)
                        } else if (type === 'add') {
                            parentNode!.appendChild(targetNode!)
                        }
                        break
                }
            })

            break
        case SnapshotType.FORM_EL_UPDATE:
            const { id, type: formType, value } = data as FormElementObserveData
            const node = nodeStore.getNode(id) as HTMLFormElement
            if (formType === 'INPUT') {
                node.value = value
            } else if (formType === 'FOCUS') {
                node.focus()
            } else if (formType === 'BLUR') {
                node.blur()
            }
            break
    }
}