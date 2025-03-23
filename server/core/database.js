require('dotenv').config();
const { Pool } = require("pg");

const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DB,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    ssl: { rejectUnauthorized: false } // Necessário para Supabase
});

/*****************************
      PUBLIC FUNCTIONS
*****************************/

exports.SERVER_CONFIG = {};

exports.initialize = async function() {
    try {
        const client = await pool.connect();

        // Verifica se a tabela de configuração existe
        const res = await client.query("SELECT COUNT(*) FROM config;");
        if (parseInt(res.rows[0].count) === 0) {
            console.log("[O] Configuração não encontrada. Criando...");
            
            const initialConfig = {
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

            await client.query(
                "INSERT INTO config (port, passwordRequired, newPlayerDetails, globalSwitches, partySwitches, globalVariables, offlineMaps) VALUES ($1, $2, $3, $4, $5, $6, $7)", 
                [
                    initialConfig.port,
                    initialConfig.passwordRequired,
                    initialConfig.newPlayerDetails,
                    initialConfig.globalSwitches,
                    initialConfig.partySwitches,
                    initialConfig.globalVariables,
                    initialConfig.offlineMaps
                ]
            );

            console.log("[I] Configuração inicial criada.");
        }

        client.release();
        console.log("[I] Database inicializado com sucesso!");
    } catch (err) {
        console.error("[X] Erro ao inicializar o banco:", err);
    }
};

exports.getPlayers = async function(callback) {
    try {
        const res = await pool.query("SELECT * FROM users;");
        callback(res.rows);
    } catch (err) {
        console.error("[X] Erro ao buscar jogadores:", err);
        callback([]);
    }
};

exports.findUser = async function(userDetails, callback) {
    try {
        const res = await pool.query("SELECT * FROM users WHERE LOWER(username) = LOWER($1);", [userDetails.username]);
        callback(res.rows);
    } catch (err) {
        console.error("[X] Erro ao buscar usuário:", err);
        callback([]);
    }
};

exports.findUserById = async function(userId, callback) {
    try {
        const res = await pool.query("SELECT * FROM users WHERE id = $1;", [userId]);
        callback(res.rows[0]);
    } catch (err) {
        console.error("[X] Erro ao buscar usuário por ID:", err);
        callback(null);
    }
};

exports.deleteUser = async function(userId, callback) {
    try {
        await pool.query("DELETE FROM users WHERE id = $1;", [userId]);
        callback(true);
    } catch (err) {
        console.error("[X] Erro ao deletar usuário:", err);
        callback(false);
    }
};

exports.registerUser = async function(userDetails, callback) {
    try {
        const userPayload = { 
            username: userDetails.username,
            permission: 0,
            password: userDetails.password ? MMO_Core.security.hashPassword(userDetails.password.toLowerCase()) : null
        };

        await pool.query(
            "INSERT INTO users (username, permission, password) VALUES ($1, $2, $3);", 
            [userPayload.username, userPayload.permission, userPayload.password]
        );

        callback(true);
    } catch (err) {
        console.error("[X] Erro ao registrar usuário:", err);
        callback(false);
    }
};

exports.savePlayer = async function(playerData, callback) {
    try {
        await pool.query(
            "UPDATE users SET mapId = $1, x = $2, y = $3, stats = $4 WHERE username = $5;", 
            [playerData.mapId, playerData.x, playerData.y, playerData.stats, playerData.username]
        );

        callback(true);
    } catch (err) {
        console.error("[X] Erro ao salvar jogador:", err);
        callback(false);
    }
};

exports.getBanks = async function(callback) {
    try {
        const res = await pool.query("SELECT * FROM banks;");
        callback(res.rows);
    } catch (err) {
        console.error("[X] Erro ao buscar bancos:", err);
        callback([]);
    }
};

exports.getBank = async function(bankName, callback) {
    try {
        const res = await pool.query("SELECT * FROM banks WHERE name = $1;", [bankName]);
        callback(res.rows[0]);
    } catch (err) {
        console.error("[X] Erro ao buscar banco:", err);
        callback(null);
    }
};

exports.saveBank = async function(bank, callback) {
    try {
        await pool.query("UPDATE banks SET content = $1 WHERE id = $2;", [bank.content, bank.id]);
        callback(true);
    } catch (err) {
        console.error("[X] Erro ao salvar banco:", err);
        callback(false);
    }
};

exports.createBank = async function(payload, callback) {
    try {
        const content = (payload.type === "global") ? { items: {}, weapons: {}, armors: {}, gold: 0 } : {};

        await pool.query(
            "INSERT INTO banks (name, type, content) VALUES ($1, $2, $3);", 
            [payload.name, payload.type, content]
        );

        callback(true);
    } catch (err) {
        console.error("[X] Erro ao criar banco:", err);
        callback(false);
    }
};

exports.reloadConfig = async function(callback) {
    try {
        const res = await pool.query("SELECT * FROM config LIMIT 1;");
        exports.SERVER_CONFIG = res.rows[0];
        callback();
    } catch (err) {
        console.error("[X] Erro ao recarregar configuração:", err);
        callback();
    }
};

exports.saveConfig = async function() {
    try {
        await pool.query(
            "UPDATE config SET newPlayerDetails = $1, globalSwitches = $2, partySwitches = $3, globalVariables = $4, offlineMaps = $5 WHERE id = 1;", 
            [
                exports.SERVER_CONFIG.newPlayerDetails,
                exports.SERVER_CONFIG.globalSwitches,
                exports.SERVER_CONFIG.partySwitches,
                exports.SERVER_CONFIG.globalVariables,
                exports.SERVER_CONFIG.offlineMaps
            ]
        );

        console.log("[I] Configuração do servidor salva.");
    } catch (err) {
        console.error("[X] Erro ao salvar configuração:", err);
    }
};