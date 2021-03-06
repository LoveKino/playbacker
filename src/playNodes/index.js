'use strict';

let pageQueueModel = require('page-queue-model');

let getWinId = require('./getWinId');

let {
    reduce
} = require('bolzano');

let {
    getFragments
} = require('../model');

let toNextMoment = require('./toNextMoment');

let runAction = require('play-web-action');

let id = v => v;

/**
 * node: state -> action -> state -> action -> state
 */
module.exports = (nodes, {
    winId,
    rootId,
    prefix,
    call,
    memory,
    sandbox
}) => {
    // split nodes
    let fragments = getFragments(nodes);

    let {
        start, getJobOrder
    } = pageQueueModel(fragments, {
        winId,
        rootId,
        call,
        memory,
        sandbox,
        prefix
    });

    let startRun = ({
        beforeWaitNextMoment = id, beforeRunAction = id, afterRunAction = id, errorAction = id, log = id
    }) => {
        // progress
        let runItem = (action) => {
            // before wait
            return Promise.resolve(beforeWaitNextMoment(action)).then(ret => {
                if (ret === 'stop') return;

                return toNextMoment(action).then(() => {
                    return Promise.resolve(beforeRunAction(action)).then(() => {
                        // run action
                        return runAction(action, {
                            log
                        });
                    }).then(() => {
                        return afterRunAction(action);
                    });
                }).catch((err) => {
                    errorAction(action, err);
                    throw err;
                });
            });
        };

        return start(runItem, getWinId);
    };

    let getInitState = () => {
        let actions = reduce(fragments, (prev, frg) => {
            prev = prev.concat(frg);
            return prev;
        }, []);

        if (!actions.length) return;
        // get action index
        // find the next state
        return getJobOrder().then(order => {
            if (order === -1) {
                return actions[0].beforeState;
            } else if (order >= actions.length) {
                return actions[actions.length - 1].afterState;
            } else {
                return actions[order].afterState;
            }
        });
    };

    return {
        startRun, getJobOrder, getInitState
    };
};
