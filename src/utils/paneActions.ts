import EventEmitter from 'eventemitter3'

/**
 * Lets a pane's settings dialog trigger actions on the mounted pane
 * (restart, snapshot, reload...) without holding a reference to it.
 *
 * paneActions.emit('restart', paneId, event)
 * paneActions.on('restart', (paneId, event) => { ... })
 */
const paneActions = new EventEmitter()

export default paneActions
