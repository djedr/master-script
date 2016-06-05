function bindNodes(bindings, document) {
    var binding, k, kk, i, eventHandlers, nodes, node, parent;

    for (k in bindings) {
        binding = bindings[k];
        eventHandlers = binding["event-handlers"];

        if (k[0] === ".") {
            binding.nodes = document.querySelectorAll(k);
        } else {
            node = document.getElementById(k);
            binding.node = node;
            binding.nodes = [node];
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
        if (binding.init) {
            nodes = binding.nodes;
            for (i = 0; i < nodes.length; ++i) {
                binding.init(binding, nodes[i]);
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

function bindData(binding, data) {
    var attr = binding.attr || "textContent", i;
    for (i = 0; i < binding.nodes.length; ++i) {
        binding.nodes[i][attr] = data;
    }
}

// could fire and handle events for updating
function updateBindings(bindings, datas) {
    var data, binding, blueprintNode, parentNode, newNode, nodes, k, i, j;
    for (k in datas) {
        data = datas[k];
        binding = bindings[k];

        if (!bindings[k])
            continue;

        binding.data = data;

        if (Array.isArray(data)) {
            for (i = 0; i < binding.blueprintNodes.length; ++i) {
                blueprintNode = binding.blueprintNodes[i];
                parentNode = binding.parentNodes[i];
                nodes = binding.cloneNodes[i];

                // clear previous nodes
                for (j = 0; j < nodes.length; ++j) {
                    parentNode.removeChild(nodes[j]);
                }
                binding.cloneNodes[i] = [];

                data.forEach((item, k) => {
                    // detach blueprint node from parent
                    bindData(binding, item);
                    newNode = blueprintNode.cloneNode(true);
                    newNode.id += '[' + k + ']';
                    binding.cloneNodes[i].push(newNode);
                    parentNode.appendChild(newNode);
                });
            }
            // blueprintNode = binding.blueprintNode;
            // parentNode = binding.parentNode;
            // nodes = binding.cloneNodes;

            // // clear previous nodes
            // for (i = 0; i < nodes.length; ++i) {
            //     parentNode.removeChild(nodes[i]);
            // }
            // binding.cloneNodes = [];

            // data.forEach((item, i) => {
            //     // detach blueprint node from parent
            //     bindData(binding, item);
            //     newNode = blueprintNode.cloneNode(true);
            //     newNode.id += '[' + i + ']';
            //     binding.cloneNodes.push(newNode);
            //     parentNode.appendChild(newNode);
            // });
        } else {
            bindData(binding, data);
        }
    }

    for (k in bindings) {
        binding = bindings[k];
        if (binding["data-from"]) {
            bindData(binding, bindings[binding["data-from"]].data)
        }
    }
}