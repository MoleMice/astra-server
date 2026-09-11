const {
    players,
    createPlayer,
    getPlayer
} = require("./playerData");

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

const sessions = new Map();

function createSession() {

    const sessionId =
        crypto.randomBytes(32).toString("hex");

    sessions.set(
        sessionId,
        {
            playerId: sessionId,
            createdAt: Date.now()
        }
    );

    createPlayer(sessionId);

    return sessionId;
}

const requestLimits = new Map();

function rateLimit(
    key,
    cooldown
) {

    const now =
        Date.now();

    const previous =
        requestLimits.get(key) || 0;

    if (
        now - previous <
        cooldown
    ) {

        return false;

    }

    requestLimits.set(
        key,
        now
    );

    return true;

}

function getAuthenticatedPlayer(req) {

    const auth =
        req.headers.authorization;

    if (!auth || !auth.startsWith("Bearer ")) {
        return null;
    }

    const sessionId =
        auth.slice("Bearer ".length);

    const session =
        sessions.get(sessionId);

    if (!session) {
        return null;
    }

    return {
        sessionId,
        playerId: session.playerId,
        player: getPlayer(session.playerId)
    };
}

app.use(cors());
app.use(express.json());

app.post("/api/session", (req, res) => {

    if (
        !rateLimit(
            `session:${req.ip}`,
            3000
        )
    ) {

    return res.status(429).json({
        error:
            "Too many requests"
    });

}

    const sessionId =
        createSession();

    res.json({
        success: true,
        sessionId
    });

});

app.get("/api/status", (req, res) => {
    res.json({
        online: true,
        game: "ASTRA",
        message: "ASTRA server is online!"
    });
});

app.get("/api/player", (req, res) => {

    const auth =
        getAuthenticatedPlayer(req);

    if (!auth) {
        return res.status(401).json({
            error: "Unauthorized"
        });
    }

    res.json(auth.player);

});

const OBJECTS = {
    moon: {
        power: 1,
        rarity: "common"
    },

    mars: {
        power: 3,
        rarity: "common"
    },

    mercury: {
        power: 5,
        rarity: "common"
    },

    venus: {
        power: 7,
        rarity: "common"
    },

    uranus: {
        power: 12,
        rarity: "uncommon"
    },

    neptune: {
        power: 20,
        rarity: "uncommon"
    },

    europa: {
        power: 26,
        rarity: "uncommon"
    },

    saturn: {
        power: 75,
        rarity: "rare"
    },

    pulsar: {
        power: 110,
        rarity: "rare"
    },

    supernova: {
        power: 400,
        rarity: "epic"
    },

    quasar: {
        power: 650,
        rarity: "epic"
    },

    blackhole: {
        power: 2500,
        rarity: "legendary"
    },

    earth: {
        power: 4,
        rarity: "common"
    },

    jupiter: {
        power: 32,
        rarity: "uncommon"
    },

    titan: {
        power: 40,
        rarity: "uncommon"
    },

    redgiant: {
        power: 130,
        rarity: "rare"
    },

    neutronstar: {
        power: 500,
        rarity: "epic"
    },

    hypergiant: {
        power: 800,
        rarity: "epic"
    },

    magnetar: {
        power: 3500,
        rarity: "legendary"
    }
};

const RARITY_MULTIPLIERS = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5
};

function getObjectCashPerClick(objectId) {
    const object = OBJECTS[objectId];

    if (!object) {
        return 0;
    }

    return object.power * RARITY_MULTIPLIERS[object.rarity];
}

function getCashPerClick(player) {
    return player.discovered.reduce((total, objectId) => {
        return total + getObjectCashPerClick(objectId);
    }, 0);
}

function getScanCost(player) {
    return Math.max(100, getCashPerClick(player) * 100);
}

const BANNERS = {
    "deep-space": [
        { id: "moon", chance: 42 },
        { id: "mars", chance: 27 },
        { id: "mercury", chance: 12 },
        { id: "venus", chance: 8 },
        { id: "uranus", chance: 4.5 },
        { id: "neptune", chance: 2.5 },
        { id: "europa", chance: 1.5 },
        { id: "saturn", chance: 1 },
        { id: "pulsar", chance: 0.3 },
        { id: "supernova", chance: 0.15 },
        { id: "quasar", chance: 0.04 },
        { id: "blackhole", chance: 0.01 }
    ],

    "stellar-frontier": [
        { id: "earth", chance: 38 },
        { id: "mars", chance: 25 },
        { id: "venus", chance: 13 },
        { id: "mercury", chance: 9 },
        { id: "jupiter", chance: 6 },
        { id: "neptune", chance: 4 },
        { id: "titan", chance: 2 },
        { id: "saturn", chance: 1.5 },
        { id: "redgiant", chance: 0.8 },
        { id: "neutronstar", chance: 0.5 },
        { id: "hypergiant", chance: 0.19 },
        { id: "magnetar", chance: 0.01 }
    ]
};

function serverWeightedRandom(banner) {
    const objects = BANNERS[banner];

    if (!objects) {
        throw new Error("Invalid banner");
    }

    const totalChance = objects.reduce(
        (total, object) => total + object.chance,
        0
    );

    let roll = Math.random() * totalChance;

    for (const object of objects) {
        roll -= object.chance;

        if (roll <= 0) {
            return object.id;
        }
    }

    return objects[0].id;
}

const lastGacha = new Map();

function updatePlayerRarity(player) {

    const rarityOrder = [
        "common",
        "uncommon",
        "rare",
        "epic",
        "legendary"
    ];

    player.rarest =
        player.discovered.reduce(
            (highest, id) => {

                const rarity =
                    OBJECTS[id]?.rarity;

                if (!rarity) {
                    return highest;
                }

                return rarityOrder.indexOf(
                    rarity
                ) >
                rarityOrder.indexOf(
                    highest
                )
                    ? rarity
                    : highest;

            },
            "common"
        );

}

app.post("/api/gacha", (req, res) => {

    const auth =
        getAuthenticatedPlayer(req);

    if (!auth) {

        return res.status(401).json({
            error: "Unauthorized"
        });

    }

    const { banner } =
        req.body;

    if (!BANNERS[banner]) {

        return res.status(400).json({
            error: "Invalid banner"
        });

    }

    const player =
        auth.player;

    const now =
        Date.now();

    const previous =
        lastGacha.get(auth.playerId) || 0;

    const GACHA_COOLDOWN = 1000;

    if (
        now - previous <
        GACHA_COOLDOWN
    ) {

        return res.status(429).json({
            error: "Scanning too quickly"
        });

    }

    lastGacha.set(
        auth.playerId,
        now
    );

    const cost =
        getScanCost(player);

    if (
        player.stardust <
        cost
    ) {

        return res.status(400).json({
            error: "Not enough Stardust",
            cost,
            stardust:
                player.stardust
        });

    }

    player.stardust -=
        cost;

    const objectId =
        serverWeightedRandom(
            banner
        );

    const object =
        OBJECTS[objectId];

    const isNew =
        !player.discovered.includes(
            objectId
        );

    let reward = 0;

    if (isNew) {

        player.discovered.push(
            objectId
        );

        player.totalDiscoveries =
            player.discovered.length;

        reward =
            getObjectCashPerClick(
                objectId
            );

        player.stardust +=
            reward;

    } else {

        reward =
            Math.floor(
                cost * 0.40
            );

        player.stardust +=
            reward;

    }

    player.equipped =
        objectId;

    updatePlayerRarity(
        player
    );

    res.json({
        success: true,
        object: objectId,
        isNew,
        reward,
        cost,
        stardust:
            player.stardust,
        discovered:
            player.discovered,
        totalDiscoveries:
            player.totalDiscoveries,
        equipped:
            player.equipped,
        rarest:
            player.rarest
    });

});

app.post("/api/equip", (req, res) => {

    const auth =
        getAuthenticatedPlayer(req);

    if (!auth) {

        return res.status(401).json({
            error: "Unauthorized"
        });

    }

    const {
        objectId
    } = req.body;

    if (
        !objectId ||
        typeof objectId !== "string"
    ) {

        return res.status(400).json({
            error: "Invalid object"
        });

    }

    if (!OBJECTS[objectId]) {

        return res.status(400).json({
            error: "Unknown object"
        });

    }

    const player =
        auth.player;

    if (
        !player.discovered.includes(
            objectId
        )
    ) {

        return res.status(403).json({
            error:
                "You have not discovered this object"
        });

    }

    player.equipped =
        objectId;

    res.json({
        success: true,
        equipped:
            player.equipped
    });

});

const lastCollect = new Map();

app.post("/api/collect", (req, res) => {

    const auth =
        getAuthenticatedPlayer(req);

    if (!auth) {
        return res.status(401).json({
            error: "Unauthorized"
        });
    }

    const playerId =
        auth.playerId;

    const now =
        Date.now();

    const previous =
        lastCollect.get(playerId) || 0;

    const COOLDOWN = 15;

    if (now - previous < COOLDOWN) {

        return res.status(429).json({
            error: "Collecting too quickly"
        });

    }

    lastCollect.set(
        playerId,
        now
    );

    const player =
        auth.player;

    const amount =
        getObjectCashPerClick(
            player.equipped
        );

    if (amount <= 0) {

        return res.status(400).json({
            error: "Invalid equipped object"
        });

    }

    player.stardust +=
        amount;

    res.json({
        success: true,
        amount,
        stardust:
            player.stardust
    });

});

app.get("/api/leaderboard", (req, res) => {

    const auth =
        getAuthenticatedPlayer(req);

    if (!auth) {

        return res.status(401).json({
            error: "Unauthorized"
        });

    }

    const leaderboard =
        [];

    for (
        const [playerId, player]
        of players
    ) {

        leaderboard.push({
            name:
                playerId === auth.playerId
                    ? "YOU"
                    : "PLAYER",

            stardust:
                player.stardust,

            rarity:
                player.rarest,

            discoveries:
                player.discovered.length
        });

    }

    res.json({
        players:
            leaderboard
    });

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`ASTRA server running on port ${PORT}`);
});
