// Custom MQTT datasource plugin for Freeboard
// Uses the Paho MQTT JavaScript client via a working CDN

freeboard.loadDatasourcePlugin({
    type_name: "paho_mqtt",
    display_name: "MQTT",
    external_scripts: [
        "https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js"
    ],
    settings: [
        {
            name: "server",
            display_name: "Server",
            type: "text",
            default_value: "test.mosquitto.org"
        },
        {
            name: "port",
            display_name: "Port",
            type: "number",
            default_value: 8081
        },
        {
            name: "topic",
            display_name: "Topic",
            type: "text",
            default_value: "kkbb/all"
        },
        {
            name: "use_ssl",
            display_name: "Use SSL (wss)",
            type: "boolean",
            default_value: true
        }
    ],
    newInstance: function (settings, newInstanceCallback, updateCallback) {
        newInstanceCallback(new mqttDatasource(settings, updateCallback));
    }
});

function mqttDatasource(settings, updateCallback) {
    var self = this;
    var currentSettings = settings;
    var client = null;
    var reconnectTimer = null;

    function makeClientId() {
        var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        var id = "fb";
        for (var i = 0; i < 10; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }

    function connect() {
        if (client) {
            try { client.disconnect(); } catch (e) {}
        }

        var clientId = makeClientId();
        client = new Paho.MQTT.Client(currentSettings.server, Number(currentSettings.port), clientId);

        client.onConnectionLost = function (responseObject) {
            if (responseObject.errorCode !== 0) {
                console.log("MQTT connection lost: " + responseObject.errorMessage + " -- retrying in 3s");
            }
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(connect, 3000);
        };

        client.onMessageArrived = function (message) {
            var payload = message.payloadString;
            var data;
            try {
                data = JSON.parse(payload);
            } catch (e) {
                data = payload;
            }
            updateCallback(data);
        };

        client.connect({
            useSSL: currentSettings.use_ssl,
            timeout: 10,
            keepAliveInterval: 30,
            mqttVersion: 4,
            cleanSession: true,
            onSuccess: function () {
                console.log("MQTT connected, subscribing to " + currentSettings.topic);
                client.subscribe(currentSettings.topic, { qos: 0 });
            },
            onFailure: function (e) {
                console.log("MQTT connect failed: " + e.errorMessage + " -- retrying in 3s");
                if (reconnectTimer) clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(connect, 3000);
            }
        });
    }

    this.updateNow = function () {
        // MQTT pushes data automatically; nothing to poll here.
    };

    this.onDispose = function () {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (client) {
            try { client.disconnect(); } catch (e) {}
        }
    };

    this.onSettingsChanged = function (newSettings) {
        currentSettings = newSettings;
        connect();
    };

    connect();
}
