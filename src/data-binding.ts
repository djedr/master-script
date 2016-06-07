function bindNodes(bindings, document) {
    var binding, k, kk, i, eventHandlers, nodes, node, parent, init, states;

    for (k in bindings) {
        binding = bindings[k];
        eventHandlers = binding["event-handlers"];

        if (k[0] === ".") {
            binding.nodes = document.querySelectorAll(k);
        } else {
            node = document.getElementById(k);
            if (node) {
                binding.node = node;
                binding.nodes = [node];
            } else {
                binding.nodes = [];
            }
        }

        // addEventListeners
        if (eventHandlers) {
            nodes = binding.nodes;
            for (kk in eventHandlers) {
                for (i = 0; i < nodes.length; ++i) {
                    nodes[i].addEventListener(kk, eventHandlers[kk]);
                }
            }
        }

        // initialize
        init = binding.init;
        if (init) {
            nodes = binding.nodes;
            if (init.length > 2) {
                binding.states = states = [];
                for (i = 0; i < nodes.length; ++i) {
                    states.push({});
                    init(binding, nodes[i], states[i]);
                }
            } else {
                for (i = 0; i < nodes.length; ++i) {
                    init(binding, nodes[i]);
                }
            }
        }

        // if list -- this could be gotten rid of and handled entirely by bindData
        if (binding.list) {
            binding.blueprintNodes = binding.nodes;
            binding.parentNodes = [];
            binding.cloneNodes = [];

            nodes = binding.nodes;
            for (i = 0; i < nodes.length; ++i) {
                node = nodes[i];
                parent = node.parentNode;
                binding.parentNodes.push(parent);
                parent.removeChild(node);
                binding.cloneNodes.push([]);
            }

            //binding.parentNode = binding.blueprintNode.parentNode;
            //binding.parentNode.removeChild(binding.blueprintNode);
            //binding.cloneNodes = [];
        }
    }
}

function bindData(binding, data, key = 0) {
    var bind = binding.bind, attr, nodes, states, i;

    nodes = binding.nodes;
    states = binding.states;

    // todo: make bind accept an object
    if (bind) {
        if (states) {
            for (i = 0; i < nodes.length; ++i) {
                bind(binding, data, key, nodes[i], states[i]);
            }
        } else {
            for (i = 0; i < nodes.length; ++i) {
                bind(binding, data, key, nodes[i]);
            }
        }
        // note: this is a hax to update bindings w/o nodes
        if (nodes.length === 0) {
            bind(binding, data);
        }
    } else {
        attr = binding.attr || "textContent";
        for (i = 0; i < nodes.length; ++i) {
            nodes[i][attr] = data;
        }
    }
}

function bindClone(binding, item, i, blueprint, clones, parent) {
    var newNode;
    bindData(binding, item, i);
    newNode = blueprint.cloneNode(true);
    newNode.id += '[' + i + ']';
    clones.push(newNode);
    parent.appendChild(newNode);
}

function arrayDataHandler(binding, data, blueprint, clones, parent) {
    for (var i = 0; i < data.length; ++i) {
        bindClone(binding, data[i], i, blueprint, clones, parent);
    }
}

function objectDataHandler(binding, data, blueprint, clones, parent) {
    for (var k in data) {
        if (Object.prototype.hasOwnProperty.call(data, k)) {
            bindClone(binding, data[k], k, blueprint, clones, parent);
        }
    }
}

// could fire and handle events for updating
function updateBindings(bindings, datas) {
    var data, binding, blueprintNode, parentNode, newNode, nodes, k, i, j, dataHandler;

    for (k in datas) {
        data = datas[k];
        binding = bindings[k];

        if (!bindings[k])
            continue;

        binding.data = data;

        if (binding.list) {

            if (!data) {
                data = [];
                console.warn("falsy data provided to iterate over!");
            }

            if (Array.isArray(data) || typeof data === "string") {
                dataHandler = arrayDataHandler;
            } else if (typeof data === "object") {
                dataHandler = objectDataHandler;
            } else {
                throw new TypeError("Provided data can't be iterated over: wrong type!");
            }

            for (i = 0; i < binding.blueprintNodes.length; ++i) {
                blueprintNode = binding.blueprintNodes[i];
                parentNode = binding.parentNodes[i];
                nodes = binding.cloneNodes[i];

                // clear previous nodes
                for (j = 0; j < nodes.length; ++j) {
                    parentNode.removeChild(nodes[j]);
                }
                nodes = binding.cloneNodes[i] = [];

                // clone blueprint for each item in data
                dataHandler(binding, data, blueprintNode, nodes, parentNode);
            }
        } else {
            bindData(binding, data);
        }

        // if (Array.isArray(data)) {
        //     for (i = 0; i < binding.blueprintNodes.length; ++i) {
        //         blueprintNode = binding.blueprintNodes[i];
        //         parentNode = binding.parentNodes[i];
        //         nodes = binding.cloneNodes[i];

        //         // clear previous nodes
        //         for (j = 0; j < nodes.length; ++j) {
        //             parentNode.removeChild(nodes[j]);
        //         }
        //         binding.cloneNodes[i] = [];

        //         // clone blueprint for each item in data
        //         data.forEach((item, k) => {
        //             // detach blueprint node from parent
        //             bindData(binding, item);
        //             newNode = blueprintNode.cloneNode(true);
        //             newNode.id += '[' + k + ']';
        //             binding.cloneNodes[i].push(newNode);
        //             parentNode.appendChild(newNode);
        //         });
        //     }
        //     // blueprintNode = binding.blueprintNode;
        //     // parentNode = binding.parentNode;
        //     // nodes = binding.cloneNodes;

        //     // // clear previous nodes
        //     // for (i = 0; i < nodes.length; ++i) {
        //     //     parentNode.removeChild(nodes[i]);
        //     // }
        //     // binding.cloneNodes = [];

        //     // data.forEach((item, i) => {
        //     //     // detach blueprint node from parent
        //     //     bindData(binding, item);
        //     //     newNode = blueprintNode.cloneNode(true);
        //     //     newNode.id += '[' + i + ']';
        //     //     binding.cloneNodes.push(newNode);
        //     //     parentNode.appendChild(newNode);
        //     // });
        // } else {
        //     bindData(binding, data);
        // }
    }

    for (k in bindings) {
        binding = bindings[k];
        if (binding["data-from"]) {
            bindData(binding, bindings[binding["data-from"]].data)
        }
    }
}