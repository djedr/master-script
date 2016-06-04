function bindNodes(bindings, document) {
    var binding, k, kk, eventHandlers;

    for (k in bindings) {
        binding = bindings[k];
        eventHandlers = binding["event-handlers"];

        binding.node = document.getElementById(k);

        if (eventHandlers)
            for (kk in eventHandlers) {
                binding.node.addEventListener(kk, eventHandlers[kk]);
            }

        if (binding.list) {
            binding.parentNode = binding.node.parentNode;
            binding.parentNode.removeChild(binding.node);
            binding.nodes = [];
        }
    }
}

function bindData(binding, data) {
    var attr = binding.attr || "textContent";
    binding.node[attr] = data;
}

// could fire and handle events for updating
function updateBindings(bindings, datas) {
    var data, binding, blueprintNode, parentNode, newNode, nodes, k, i;
    for (k in datas) {
        data = datas[k];
        binding = bindings[k];
        binding.data = data;

        if (Array.isArray(data)) {
            blueprintNode = binding.node;
            parentNode = binding.parentNode;
            nodes = binding.nodes;

            // clear previous nodes
            for (i = 0; i < nodes.length; ++i) {
                parentNode.removeChild(nodes[i]);
            }
            binding.nodes = [];

            data.forEach((item, i) => {
                // detach blueprint node from parent
                bindData(binding, item);
                newNode = blueprintNode.cloneNode(true);
                newNode.id += '[' + i + ']';
                binding.nodes.push(newNode);
                parentNode.appendChild(newNode);
            });
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