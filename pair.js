const PastebinAPI = require('pastebin-js');
const pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require('pino');
const {
    default: eryan,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;
    
    async function ARYAN_MD_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            let Pair_Code_By_ARYAN = ARYAN_Tech({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
                },
                version: [2, 3000, 1027934701],
                printQRInTerminal: false,
                logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
                browser: Browsers.windows('Edge'),
            });

            if (!Pair_Code_By_ARYAN-TECH.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
               const custom = "ARYAN";
                const code = await Pair_Code_By_ARYAN.requestPairingCode(num,custom);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            Pair_Code_By_ARYAN.ev.on('creds.update', saveCreds);
            Pair_Code_By_ARYAN.ev.on('connection.update', async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === 'open') {
                    await delay(5000);
                    Pair_Code_By_ARYAN.groupAcceptInvite('F4L9boph6pUH7vpGTWbfan');
                    let data = fs.readFileSync(__dirname + `/temp/${id}/creds.json`);
                    await delay(1000);
                    let b64data = Buffer.from(data).toString('base64');
                    let session = await Pair_Code_By_aryan_Tech.sendMessage(Pair_Code_By_aryan_Tech.user.id, { text: 'ARYAN-MD:~' + b64data });

                    let Mbuvi_MD_TEXT = `🟢session paired successfully\n🟢Type: Base64\n🟢Status: active and online\n🟢Owner: June`;

                    await Pair_Code_By_ARYAN-TECH.sendMessage(Pair_Code_By_aryan_Tech.user.id, { text: Aryan_MD_TEXT }, { quoted: session });

                    await delay(100);
                    await Pair_Code_By_aryan_Tech.ws.close();
                    return await removeFile('./temp/' + id);
                } else if (connection === 'close' && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    aryan_MD_PAIR_CODE();
                }
            });
        } catch (err) {
            console.log('Service restarted');
            await removeFile('./temp/' + id);
            if (!res.headersSent) {
                await res.send({ code: 'Service Currently Unavailable' });
            }
        }
    }
    
    return await Aryan_MD_PAIR_CODE();
});

module.exports = router;
