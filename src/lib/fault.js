function Fault(info) {
    this.name = 'Fault';
    this.message = JSON.stringify(info);
    this.info = info;
}

// reference: https://node.readthedocs.io/en/latest/api/modules/
module.exports = Fault;
