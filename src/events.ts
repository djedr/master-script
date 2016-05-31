var eventListeners = Object.create({}),
    events = Object.create({});

function createEvent(name, props) {
    if (props !== Object(props)) { // if not a valid object
        props = {};
    }
    events[name] = Object.create(props);
}

function emitEvent(name, props) {
    var currentEventListeners = eventListeners[name],
        event;
    if (currentEventListeners) {
        event = events[name];
        if (props === Object(props)) {
            for (var p in props) {
                event[p] = props[p];
            }
        }
        for (var i = 0; i < currentEventListeners.length; ++i) {
            currentEventListeners[i](event);
        }
    }
}

function listenEvent(name, listener) {
    if (!eventListeners[name]) {
        eventListeners[name] = [];
    }
    eventListeners[name].push(listener);
}

function unlistenEvent(name, listener) {
    var currentEventListeners = eventListeners[name];
    if (currentEventListeners) {
        for (var i = 0; i < currentEventListeners.length; ++i) {
            if (currentEventListeners[i] === listener) {
                currentEventListeners.splice(i, 1);
            }
        }
    }
}
