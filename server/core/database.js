/* global MMO_Core, onConnect */
const r = require("rethinkdb");
const async = require("async");

// Configuração do Servidor
exports.SERVER_CONFIG = {};

// Inicializar Banco de Dados
exports.initialize = function(callback) {
    const tables = ["users", "banks", "config"];

    onConnect(function(_err, conn) {
        const initialServerConfig = {
            port: 8097,
            passwordRequired: true,
            newPlayerDetails: {
                permission: 0,
                mapId: 1,
                skin: {
                    characterIndex: 0,
                    characterName: "Actor1",
                    battlerName: "Actor1_1",
                    faceName: "Actor1",
                    faceIndex: 0
                },
                x: 5,
                y: 5
            },
            globalSwitches: {},
            partySwitches: {},
            globalVariables: {},
            offlineMaps: {}
        };

        r.dbList().run(conn, function(_err, results) {
            if (results.indexOf("mmorpg") !== -1) {
                conn.close();
                MMO_Core.security.loadTokens();
                console.log("[I] Database initialized successfully!");
                return callback();
            }

            console.log("[O] Database not found! Creating now...");
            r.dbCreate("mmorpg").run(conn, function(_err, result) {
                console.log("[I] Database created successfully!");

                async.each(tables, function(item, callback) {
                    r.db("mmorpg").tableCreate(item).run(conn, function(_err, result) {
                        console.log(`[I] Table ${item} created successfully!`);

                        if (item === "users") {
                            const user = initialServerConfig.newPlayerDetails;
                            user.username = "admin";
                            user.password = MMO_Core.security.hashPassword("admin");
                            user.permission = 100;

                            r.db("mmorpg").table("users").insert([user]).run(conn, (_err, result) => {
                                console.log("[I] Initial admin account created.");
                                return callback();
                            });
                        } else if (item === "config") {
                            r.db("mmorpg").table("config").insert([initialServerConfig]).run(conn, (_err, result) => {
                                console.log("[I] Initial server configuration created successfully.");
                                return callback();
                            });
                        } else {
                            return callback();
                        }
                    });
                }, function(_err) {
                    conn.close();
                    console.log("[I] Database is fully set up! 🚀");
                    return callback();
                });
            });
        });
    });
};

// Conectar ao RethinkDB
onConnect = function(callback) {
    r.connect({
        host: process.env.RETHINKDB_HOST || "localhost",
        port: parseInt(process.env.RETHINKDB_PORT) || 28015,
        password: process.env.RETHINKDB_PASSWORD || "" // Adicionada autenticação por senha
    }, function(err, connection) {
        if (err) {
            console.error("[❌] Error connecting to RethinkDB:", err);
            return callback(err, null);
        }
        console.log("[✅] Connected to RethinkDB!");
        callback(null, connection);
    });
};

// Buscar todos os usuários
exports.getPlayers = function(callback) {
    onConnect(function(_err, conn) {
        if (_err) return callback([]);
        r.db("mmorpg").table("users").run(conn)
            .then(cursor => cursor.toArray())
            .then(output => callback(output))
            .finally(() => conn.close());
    });
};

// Encontrar usuário pelo nome
exports.findUser = function(userDetails, callback) {
    onConnect(function(_err, conn) {
        if (_err) return callback([]);
        r.db("mmorpg").table("users")
            .filter(user => user("username").match("(?i)^" + userDetails.username + "$"))
            .run(conn)
            .then(cursor => cursor.toArray())
            .then(output => callback(output))
            .finally(() => conn.close());
    });
};

// Deletar usuário
exports.deleteUser = function(userId, callback) {
    onConnect(function(_err, conn) {
        if (_err) return callback(null);
        r.db("mmorpg").table("users").get(userId).delete().run(conn)
            .then(output => callback(output))
            .finally(() => conn.close());
    });
};

// Registrar novo usuário
exports.registerUser = function(userDetails, callback) {
    const userPayload = exports.SERVER_CONFIG.newPlayerDetails;
    userPayload.username = userDetails.username;
    userPayload.permission = 0;
    if (exports.SERVER_CONFIG.passwordRequired) {
        userPayload.password = MMO_Core.security.hashPassword(userDetails.password.toLowerCase());
    }

    onConnect(function(_err, conn) {
        if (_err) return callback(null);
        r.db("mmorpg").table("users").insert(userPayload).run(conn)
            .then(output => callback(output))
            .finally(() => conn.close());
    });
};

// Salvar usuário
exports.savePlayer = function(playerData, callback) {
    onConnect(function(_err, conn) {
        if (_err) return callback(null);
        r.db("mmorpg").table("users")
            .filter(user => user("username").match("(?i)^" + playerData.username + "$"))
            .update(playerData)
            .run(conn)
            .then(output => callback(output))
            .finally(() => conn.close());
    });
};

// Criar um novo banco (cofre)
exports.createBank = function(payload, callback) {
    const content = (payload.type === "global") ? { items: {}, weapons: {}, armors: {}, gold: 0 } : {};
    const template = {
        name: payload.name,
        type: payload.type,
        content: content
    };

    onConnect(function(_err, conn) {
        if (_err) return callback(null);
        r.db("mmorpg").table("banks").insert(template).run(conn)
            .then(output => callback(output))
            .finally(() => conn.close());
    });
};

// Atualizar configuração do servidor
exports.changeConfig = function(type, payload, callback) {
    onConnect(function(_err, conn) {
        if (_err) return callback(null);
        let query = r.db("mmorpg").table("config")(0);

        const updates = {
            globalSwitches: { globalSwitches: r.literal(payload) },
            partySwitches: { partySwitches: r.literal(payload) },
            offlineMaps: { offlineMaps: r.literal(payload) },
            globalVariables: { globalVariables: r.literal(payload) },
            newPlayerDetails: { newPlayerDetails: r.literal(payload) }
        };

        query = query.update(updates[type] || {});
        query.run(conn)
            .then(() => exports.reloadConfig(() => console.log("[I] Server configuration updated.")))
            .finally(() => conn.close());
    });
};

// Recarregar configuração do servidor
exports.reloadConfig = function(callback) {
    onConnect(function(_err, conn) {
        if (_err) return callback();
        r.db("mmorpg").table("config")(0).run(conn)
            .then(output => {
                exports.SERVER_CONFIG = output;
                callback();
            })
            .finally(() => conn.close());
    });
};
