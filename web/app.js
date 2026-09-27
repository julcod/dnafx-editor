"use strict";

/*
 * Web editor for DNAfx GiT presets, on top of the dnafx-editor
 * WebSocket API (./dnafx-editor -H 8000).
 */

/* Value ranges: most parameters go from 0 to 100. The others were guessed
 * from the factory presets, and the ones marked as unsure need checking */
const DEFAULT_RANGE = { min: 0, max: 100 };
const RANGES = {
	"CAB": {
		"TUBE": { min: 0, max: 4, unsure: true },
		"MIC": { min: 0, max: 9, unsure: true }
	},
	"EQ": {
		"*": { min: 4, max: 28, offset: 16, unit: "dB", unsure: true }
	},
	"DELAY": {
		"TIME": { min: 0, max: 2000, unit: "ms", unsure: true },
		"TIME A": { min: 0, max: 2000, unit: "ms", unsure: true },
		"TIME B": { min: 0, max: 2000, unit: "ms", unsure: true },
		"THRES": { min: 0, max: 2000, unsure: true },
		"SUB-D": { min: 1, max: 5, unsure: true },
		"SUB A": { min: 1, max: 5, unsure: true },
		"SUB B": { min: 1, max: 5, unsure: true }
	},
	"REVERB": {
		"P.DELAY": { min: 0, max: 250, unit: "ms", unsure: true }
	}
};

function rangeFor(section, param) {
	const s = RANGES[section];
	return (s && (s[param] || s["*"])) || DEFAULT_RANGE;
}

function defaultValue(range) {
	if(range.offset !== undefined)
		return range.offset;
	return Math.round((range.min + range.max) / 2);
}

/* Icons of the effect chain (viewBox 0 0 40 34) */
const ICONS = {
	"FX/COMP": '<path d="M4 30 L30 8 M26 6 l6 4 M10 30 h8 M30 12 v12 l3 -3 M30 24 l-3 -3"/>',
	"DS/OD": '<path d="M3 17 h4 l2 -9 l2 18 l2 -18 l2 18 l2 -18 l2 18 l2 -18 l2 18 l2 -18 l2 18 l2 -9 h4"/>',
	"AMP": '<rect x="4" y="9" width="32" height="18" rx="4"/><path d="M9 21 h22 M11 15 h.1 M16 15 h.1 M21 15 h.1 M26 15 h.1 M31 15 h.1"/>',
	"CAB": '<rect x="9" y="4" width="22" height="26" rx="2"/><rect x="15" y="12" width="10" height="7"/>',
	"NS GATE": '<path d="M3 11 h10 c4 0 5 12 9 12 h4 M3 23 h10 c4 0 5 -12 9 -12 h15"/>',
	"EQ": '<path d="M8 4 v26 M14 4 v26 M20 4 v26 M26 4 v26 M32 4 v26 M5 22 h6 M11 10 h6 M17 18 h6 M23 8 h6 M29 20 h6"/>',
	"MOD": '<ellipse cx="9" cy="17" rx="5" ry="10"/><ellipse cx="17" cy="17" rx="5" ry="10"/><ellipse cx="25" cy="17" rx="5" ry="10"/><ellipse cx="33" cy="17" rx="4" ry="10"/>',
	"DELAY": '<path d="M6 4 v26 M12 6 c4 6 4 16 0 22 M18 8 c3 5 3 13 0 18 M24 10 c2 4 2 10 0 14 M30 12 c1 3 1 7 0 10"/>',
	"REVERB": '<rect x="5" y="3" width="30" height="28"/><rect x="10" y="8" width="20" height="18"/><rect x="15" y="13" width="10" height="8"/>'
};

/* Settings (kept in the browser) */
function setting(name, value) {
	try {
		if(value === undefined)
			return localStorage.getItem("dnafx." + name);
		localStorage.setItem("dnafx." + name, value);
	} catch(e) {
		/* No storage available, not a problem */
	}
	return null;
}
function defaultWsUrl() {
	const param = new URLSearchParams(location.search).get("ws");
	if(param)
		return param;
	return "ws://" + (location.hostname || "127.0.0.1") + ":8000/";
}

/* State */
const state = {
	effects: null,		/* Sections, effects and parameters (list-effects) */
	presets: {},		/* Slot -> name */
	slot: null,			/* Preset being edited */
	original: null,		/* PHB of that preset, as it is on the device */
	current: null,		/* PHB with our changes */
	block: 2,			/* Selected section (AMP) */
	memory: {},			/* Section/effect -> Data, to restore values when switching effect back */
	backedUp: new Set(),
	sending: false,
	sendAgain: false,
	autoTimer: null
};

const $ = id => document.getElementById(id);
const clone = obj => JSON.parse(JSON.stringify(obj));
const pad3 = n => String(n).padStart(3, "0");
const isDirty = () => state.current && JSON.stringify(state.current) !== JSON.stringify(state.original);

/* Our own confirmation and input dialogs, instead of the browser ones */
function openDialog(message, okLabel, input) {
	const dialog = $("ask");
	$("ask-text").textContent = message;
	$("ask-ok").textContent = okLabel || "OK";
	$("ask-input").hidden = input === undefined;
	$("ask-input").value = input ?? "";
	return new Promise(resolve => {
		dialog.onclose = () => resolve(dialog.returnValue === "ok");
		dialog.returnValue = "";
		dialog.showModal();
		if(input !== undefined)
			$("ask-input").select();
		else
			$("ask-ok").focus();
	});
}
$("ask-input").onkeydown = e => {
	if(e.key === "Enter") {
		e.preventDefault();
		$("ask").close("ok");
	}
};
const ask = (message, okLabel) => openDialog(message, okLabel);
const askValue = (message, value) => openDialog(message, "OK", String(value)).then(ok => ok ? $("ask-input").value : null);

function log(text, error) {
	const el = $("log");
	el.textContent = text;
	el.classList.toggle("error", !!error);
	if(error)
		console.error(text);
}

/* WebSocket API: requests are processed in order, so are the responses */
let ws = null, pending = null, queue = Promise.resolve(), busy = 0;

function connect() {
	const url = setting("ws") || defaultWsUrl();
	setStatus("offline", "Connexion…");
	try {
		ws = new WebSocket(url, "dnafx-protocol");
	} catch(e) {
		log("Adresse du backend invalide : " + url, true);
		return;
	}
	ws.onopen = () => {
		setStatus("online", "Connecté");
		log("Connecté à " + url);
		start().catch(e => log(e.message, true));
	};
	ws.onclose = () => {
		setStatus("offline", "Déconnecté");
		if(pending) {
			clearTimeout(pending.timer);
			pending.reject(new Error("Connexion perdue"));
			pending = null;
		}
		setTimeout(connect, 3000);
	};
	ws.onmessage = event => {
		let msg = null;
		try {
			msg = JSON.parse(event.data);
		} catch(e) {
			return;
		}
		if(!pending)
			return;
		/* Over WebSockets, valid requests are acknowledged first: the result comes later */
		if(msg.code === 200 && msg.payload && msg.payload.reason === "Command queued")
			return;
		const p = pending;
		pending = null;
		clearTimeout(p.timer);
		if(msg.code === 200)
			p.resolve(msg.payload);
		else
			p.reject(new Error((msg.payload && msg.payload.reason) || ("Erreur " + msg.code)));
	};
}

function request(name, args) {
	const run = () => new Promise((resolve, reject) => {
		if(!ws || ws.readyState !== WebSocket.OPEN)
			return reject(new Error("Pas connecté à dnafx-editor"));
		pending = {
			resolve, reject,
			timer: setTimeout(() => {
				pending = null;
				reject(new Error("Pas de réponse à '" + name + "'"));
			}, 30000)
		};
		ws.send(JSON.stringify({ request: name, arguments: (args || []).map(String) }));
	});
	busy++;
	setStatus("busy");
	const p = queue.then(run);
	queue = p.catch(() => {});
	return p.finally(() => {
		busy--;
		if(busy === 0 && ws && ws.readyState === WebSocket.OPEN)
			setStatus("online", "Connecté");
	});
}

function setStatus(cls, text) {
	const el = $("status");
	el.className = "status " + cls;
	if(text)
		el.textContent = text;
}

/* Startup */
async function start() {
	state.effects = await request("list-effects");
	renderChain();
	await refreshPresets();
	const slot = parseInt(setting("slot"), 10) || 1;
	await selectPreset(state.presets[slot] ? slot : 1, false);
	/* The first time, capture the initial configuration */
	renderSnapshotInfo();
	if(!snapshot())
		await captureSnapshot();
}

async function refreshPresets() {
	const list = await request("list-presets");
	state.presets = {};
	for(const [id, p] of Object.entries(list.device || {}))
		state.presets[id] = p.name;
	renderPresetList();
}

/* Presets */
async function selectPreset(slot, hear) {
	if(slot < 1 || slot > 200 || !state.presets[slot])
		return;
	if(isDirty() && !await ask("Le preset affiché a des modifications non envoyées : les abandonner ?", "Abandonner"))
		return;
	const phb = await request("export-preset", [slot, "phb"]);
	state.slot = slot;
	state.original = clone(phb);
	state.current = clone(phb);
	state.memory = {};
	setting("slot", slot);
	render();
	$("preset-list").querySelector(".selected")?.scrollIntoView({ block: "nearest" });
	if(hear !== false)
		request("change-preset", [slot]).catch(e => log(e.message, true));
}

function changed() {
	render();
	if($("auto-send").checked) {
		clearTimeout(state.autoTimer);
		state.autoTimer = setTimeout(send, 400);
	}
}

function backupDir() {
	return (setting("backupDir") ?? "backups").replace(/\/+$/, "");
}

function fileName(slot, name) {
	/* Characters Windows doesn't like in file names */
	return pad3(slot) + "-" + String(name).replace(/[\\/:*?"<>|]/g, "_").replace(/[ .]+$/, "");
}

function timestamp() {
	const d = new Date(), p2 = n => String(n).padStart(2, "0");
	return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + "-" +
		p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
}

/* Before the first time we overwrite a slot, save the version the device has */
async function backup(slot) {
	const dir = backupDir();
	if(!dir || state.backedUp.has(slot) || !state.presets[slot])
		return;
	const file = dir + "/" + fileName(slot, state.presets[slot]) + "-" + timestamp() + ".bhb";
	try {
		await request("export-preset", [slot, "binary", file]);
	} catch(e) {
		throw new Error("Sauvegarde impossible (" + file + ") : " + e.message +
			". Crée le dossier, ou désactive la sauvegarde dans les réglages.");
	}
	state.backedUp.add(slot);
	log("Sauvegarde de l'ancienne version : " + file);
}

/* Write a preset (PHB object, or base64 binary) to a slot, after a backup */
async function writeSlot(slot, content) {
	await backup(slot);
	await request("load-preset", [slot, typeof content === "string" ? content : JSON.stringify(content)]);
}

async function send() {
	if(!state.current || !isDirty())
		return;
	if(state.sending) {
		state.sendAgain = true;
		return;
	}
	state.sending = true;
	$("send").classList.add("busy");
	const slot = state.slot, phb = clone(state.current);
	try {
		await backup(slot);
		const start = performance.now();
		await request("load-preset", [slot, JSON.stringify(phb)]);
		await request("change-preset", [slot]);
		if(state.slot === slot) {
			state.original = phb;
			state.presets[slot] = phb.fileInfo.preset_name;
		}
		renderPresetList();
		render();
		log("Preset " + pad3(slot) + " envoyé (" + Math.round(performance.now() - start) + " ms)");
	} catch(e) {
		log("Échec de l'envoi : " + e.message, true);
		state.sendAgain = false;
	} finally {
		state.sending = false;
		$("send").classList.remove("busy");
		if(state.sendAgain) {
			state.sendAgain = false;
			send();
		}
	}
}

/* Editing */
function section() {
	return state.effects[state.block];
}
function module() {
	return state.current.effectModule[section().name];
}
function effect() {
	return section().effects[module().TYPE];
}

function setParam(name, value) {
	const range = rangeFor(section().name, name);
	value = Math.round(value);
	const data = module().Data;
	/* Values out of the known range (which may be wrong) are left alone until changed */
	const min = Math.min(range.min, data[name]), max = Math.max(range.max, data[name]);
	value = Math.max(min, Math.min(max, value));
	if(data[name] === value)
		return;
	data[name] = value;
	changed();
}

function setEffect(type) {
	const m = module();
	if(m.TYPE === type)
		return;
	const key = section().name;
	state.memory[key + "/" + m.TYPE] = clone(m.Data);
	const eff = section().effects[type];
	const remembered = state.memory[key + "/" + type];
	const data = {};
	for(const p of eff.params) {
		if(remembered && p in remembered)
			data[p] = remembered[p];
		else if(p in m.Data)
			data[p] = m.Data[p];
		else
			data[p] = defaultValue(rangeFor(key, p));
	}
	m.TYPE = type;
	m.Data = data;
	changed();
}

function setSwitch(section, on) {
	state.current.effectModule[section].SWITCH = on ? 1 : 0;
	changed();
}

/* Rendering */
function render() {
	const ready = !!state.current;
	$("preset-name").disabled = !ready;
	$("send").disabled = !ready;
	if(!ready)
		return;
	if(document.activeElement !== $("preset-name"))
		$("preset-name").value = state.current.fileInfo.preset_name;
	$("send").classList.toggle("dirty", isDirty());
	for(const li of $("preset-list").children) {
		const slot = parseInt(li.dataset.slot, 10);
		li.classList.toggle("selected", slot === state.slot);
		li.classList.toggle("modified", slot === state.slot && isDirty());
	}
	renderChain();
	renderPanel();
}

function renderPresetList() {
	const ul = $("preset-list");
	ul.textContent = "";
	for(let slot = 1; slot <= 200; slot++) {
		if(!state.presets[slot])
			continue;
		const li = document.createElement("li");
		li.dataset.slot = slot;
		li.textContent = "P" + pad3(slot) + " " + state.presets[slot];
		li.onclick = () => selectPreset(slot).catch(e => log(e.message, true));
		/* Drag and drop: swap, or copy with Ctrl */
		li.draggable = true;
		li.ondragstart = e => {
			e.dataTransfer.setData("text/plain", String(slot));
			e.dataTransfer.effectAllowed = "copyMove";
			li.classList.add("dragging");
		};
		li.ondragend = () => li.classList.remove("dragging");
		li.ondragover = e => {
			e.preventDefault();
			e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : "move";
			li.classList.add("drop-target");
		};
		li.ondragleave = () => li.classList.remove("drop-target");
		li.ondrop = e => {
			e.preventDefault();
			li.classList.remove("drop-target");
			const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
			movePreset(from, slot, e.ctrlKey).catch(err => log(err.message, true));
		};
		ul.appendChild(li);
	}
	render();
}

function renderChain() {
	const nav = $("chain");
	if(!state.effects)
		return;
	if(!nav.children.length) {
		state.effects.forEach((s, i) => {
			const b = document.createElement("button");
			b.className = "block";
			b.title = s.name + " (double-clic : activer / désactiver)";
			b.innerHTML = '<span class="led"></span><svg viewBox="0 0 40 34">' + (ICONS[s.name] || "") +
				'</svg><span class="label">' + s.name + '</span>';
			b.onclick = () => {
				state.block = i;
				render();
			};
			b.ondblclick = () => {
				if(state.current)
					setSwitch(s.name, !state.current.effectModule[s.name].SWITCH);
			};
			nav.appendChild(b);
		});
	}
	state.effects.forEach((s, i) => {
		const b = nav.children[i];
		b.classList.toggle("selected", i === state.block);
		b.classList.toggle("on", !!(state.current && state.current.effectModule[s.name].SWITCH));
	});
}

function renderPanel() {
	const s = section(), m = module(), eff = effect();
	$("block-name").textContent = s.name;
	$("block-switch").checked = !!m.SWITCH;
	/* Effects list */
	const ul = $("model-list");
	if(ul.dataset.section !== s.name) {
		ul.dataset.section = s.name;
		ul.textContent = "";
		for(const e of s.effects) {
			const li = document.createElement("li");
			li.textContent = String(e.id).padStart(2, "0") + ": " + e.name;
			li.onclick = () => setEffect(e.id);
			ul.appendChild(li);
		}
	}
	for(const li of ul.children)
		li.classList.toggle("selected", li === ul.children[m.TYPE]);
	/* Parameters */
	$("model-title").textContent = s.name + "  -  " + String(eff.id).padStart(2, "0") + ": " + eff.name;
	const knobs = $("knobs");
	const key = s.name + "/" + eff.id;
	if(knobs.dataset.key !== key) {
		knobs.dataset.key = key;
		knobs.textContent = "";
		for(const p of eff.params)
			knobs.appendChild(createKnob(s.name, p));
	}
	for(const box of knobs.children)
		updateKnob(box, m.Data[box.dataset.param]);
}

/* Knobs, as in the official editor: ring of dots, value with arrows */
const DOTS = 11;
function createKnob(sectionName, param) {
	const range = rangeFor(sectionName, param);
	const box = document.createElement("div");
	box.className = "knob-box";
	box.dataset.param = param;
	let dots = "";
	for(let i = 0; i < DOTS; i++) {
		const a = (-135 + i * 270 / (DOTS - 1)) * Math.PI / 180;
		dots += '<circle class="dot" cx="' + (42 + 36 * Math.sin(a)).toFixed(1) + '" cy="' +
			(42 - 36 * Math.cos(a)).toFixed(1) + '" r="2.2"/>';
	}
	box.innerHTML = '<div class="name">' + param + (range.unsure ?
			' <span class="unsure" title="Plage de valeurs à confirmer (' + range.min + '…' + range.max + ')">?</span>' : "") +
		'</div><svg class="knob" viewBox="0 0 84 84">' + dots +
		'<circle class="body" cx="42" cy="42" r="26"/><line class="pointer" x1="42" y1="30" x2="42" y2="20"/></svg>' +
		'<div class="knob-value"><button class="dec">&#9664;</button><span class="value"></span><button class="inc">&#9654;</button></div>';
	const value = () => module().Data[param];
	box.querySelector(".dec").onclick = () => setParam(param, value() - 1);
	box.querySelector(".inc").onclick = () => setParam(param, value() + 1);
	const knob = box.querySelector(".knob");
	knob.addEventListener("wheel", e => {
		e.preventDefault();
		setParam(param, value() + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 10 : 1));
	}, { passive: false });
	knob.addEventListener("pointerdown", e => {
		knob.setPointerCapture(e.pointerId);
		const y0 = e.clientY, v0 = value();
		const perPixel = (range.max - range.min) / 200;
		knob.onpointermove = ev => setParam(param, v0 + (y0 - ev.clientY) * perPixel * (ev.shiftKey ? 0.2 : 1));
		knob.onpointerup = () => {
			knob.onpointermove = null;
			knob.onpointerup = null;
		};
	});
	knob.ondblclick = async () => {
		const shown = range.offset !== undefined ? range.offset : 0;
		const text = await askValue(param + " (" + (range.min - shown) + " … " + (range.max - shown) + ")", value() - shown);
		if(text !== null && text.trim() !== "" && !isNaN(text))
			setParam(param, Number(text) + shown);
	};
	return box;
}

function updateKnob(box, v) {
	const range = rangeFor(section().name, box.dataset.param);
	const min = Math.min(range.min, v), max = Math.max(range.max, v);
	const frac = max > min ? (v - min) / (max - min) : 0;
	box.querySelectorAll(".dot").forEach((d, i) => d.classList.toggle("lit", i <= Math.round(frac * (DOTS - 1))));
	box.querySelector(".pointer").setAttribute("transform", "rotate(" + (-135 + frac * 270) + " 42 42)");
	const shown = range.offset !== undefined ? v - range.offset : v;
	box.querySelector(".value").innerHTML = (range.offset !== undefined && shown > 0 ? "+" : "") + shown +
		(range.unit ? ' <span class="unit">' + range.unit + "</span>" : "");
}

/* Files */
function exportPhb() {
	if(!state.current)
		return;
	const blob = new Blob([JSON.stringify(state.current, null, "\t")], { type: "application/json" });
	download(blob, fileName(state.slot, state.current.fileInfo.preset_name) + ".phb");
}

function importPhb(file) {
	const reader = new FileReader();
	reader.onload = () => {
		let phb = null;
		try {
			phb = JSON.parse(reader.result);
		} catch(e) {
			return log("Fichier illisible : " + e.message, true);
		}
		if(!phb.effectModule || !phb.fileInfo || !phb.Exp)
			return log("Ce fichier n'est pas un preset .phb", true);
		for(const s of state.effects) {
			const m = phb.effectModule[s.name];
			if(!m || !s.effects[m.TYPE])
				return log("Preset invalide (bloc " + s.name + ")", true);
		}
		phb.fileInfo.preset_name = String(phb.fileInfo.preset_name || "").slice(0, 14);
		state.current = phb;
		log("Importé : " + file.name + " (pas encore envoyé)");
		changed();
	};
	reader.readAsText(file);
}

/* Batches of operations, with a progress dialog that can stop them */
async function runBatch(title, items, fn) {
	const dialog = $("progress");
	$("progress-title").textContent = title;
	$("progress-bar").max = items.length || 1;
	let stopped = false, done = 0;
	const failures = [];
	$("progress-cancel").onclick = () => {
		stopped = true;
	};
	dialog.oncancel = e => {
		e.preventDefault();
		stopped = true;
	};
	dialog.showModal();
	for(const item of items) {
		if(stopped)
			break;
		$("progress-bar").value = done;
		$("progress-text").textContent = (done + 1) + " / " + items.length + (item.label ? " : " + item.label : "");
		try {
			await fn(item);
		} catch(e) {
			failures.push((item.label || "") + " : " + e.message);
		}
		done++;
	}
	dialog.close();
	const summary = title + " : " + done + " / " + items.length + (stopped ? " (arrêté)" : "") +
		(failures.length ? ", " + failures.length + " échec(s) : " + failures.join(" ; ") : "");
	log(summary, failures.length > 0);
	return { done, stopped, failures };
}

/* Reload the list, and the preset being edited (which may have changed) */
async function reloadAll() {
	await refreshPresets();
	if(state.slot && state.presets[state.slot]) {
		const phb = await request("export-preset", [state.slot, "phb"]);
		state.original = clone(phb);
		state.current = clone(phb);
		render();
	}
}

async function checkDirty() {
	return !isDirty() || await ask("Le preset affiché a des modifications non envoyées : les abandonner ?", "Abandonner");
}

/* Binary presets, as base64 */
const getBinary = slot => request("export-preset", [slot, "binary"]).then(p => p.base64);
const b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
function bytesToB64(bytes) {
	let s = "";
	for(const b of bytes)
		s += String.fromCharCode(b);
	return btoa(s);
}
function sameBinary(a, b) {
	/* Bytes 159-160 look like a checksum the device computes itself: ignore them */
	const x = b64ToBytes(a), y = b64ToBytes(b);
	if(x.length !== y.length)
		return false;
	return x.every((v, i) => v === y[i] || i === 159 || i === 160);
}

/* Minimal zip support: we write stored files, and read stored or deflated ones */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for(let k = 0; k < 8; k++)
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
function crc32(data) {
	let c = 0xffffffff;
	for(const b of data)
		c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function makeZip(files) {
	const enc = new TextEncoder(), parts = [], central = [];
	const d = new Date();
	const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
	const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
	let offset = 0;
	for(const f of files) {
		const name = enc.encode(f.name), crc = crc32(f.data);
		const header = (sig, size) => {
			const h = new DataView(new ArrayBuffer(size));
			h.setUint32(0, sig, true);
			return h;
		};
		const local = header(0x04034b50, 30);
		local.setUint16(4, 20, true);
		local.setUint16(6, 0x0800, true);
		local.setUint16(10, time, true);
		local.setUint16(12, date, true);
		local.setUint32(14, crc, true);
		local.setUint32(18, f.data.length, true);
		local.setUint32(22, f.data.length, true);
		local.setUint16(26, name.length, true);
		const entry = header(0x02014b50, 46);
		entry.setUint16(4, 20, true);
		entry.setUint16(6, 20, true);
		entry.setUint16(8, 0x0800, true);
		entry.setUint16(12, time, true);
		entry.setUint16(14, date, true);
		entry.setUint32(16, crc, true);
		entry.setUint32(20, f.data.length, true);
		entry.setUint32(24, f.data.length, true);
		entry.setUint16(28, name.length, true);
		entry.setUint32(42, offset, true);
		parts.push(local, name, f.data);
		central.push(entry, name);
		offset += 30 + name.length + f.data.length;
	}
	const size = central.reduce((n, p) => n + p.byteLength, 0);
	const end = new DataView(new ArrayBuffer(22));
	end.setUint32(0, 0x06054b50, true);
	end.setUint16(8, files.length, true);
	end.setUint16(10, files.length, true);
	end.setUint32(12, size, true);
	end.setUint32(16, offset, true);
	return new Blob([...parts, ...central, end], { type: "application/zip" });
}

async function readZip(buffer) {
	const view = new DataView(buffer), files = [];
	let eocd = buffer.byteLength - 22;
	while(eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50)
		eocd--;
	if(eocd < 0)
		throw new Error("fichier zip invalide");
	let p = view.getUint32(eocd + 16, true);
	const count = view.getUint16(eocd + 10, true);
	const dec = new TextDecoder();
	for(let i = 0; i < count; i++) {
		const method = view.getUint16(p + 10, true), csize = view.getUint32(p + 20, true);
		const nlen = view.getUint16(p + 28, true), xlen = view.getUint16(p + 30, true), clen = view.getUint16(p + 32, true);
		const name = dec.decode(new Uint8Array(buffer, p + 46, nlen));
		const local = view.getUint32(p + 42, true);
		const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
		let data = new Uint8Array(buffer, start, csize);
		if(method === 8)
			data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
		else if(method !== 0)
			data = null;
		if(data && !name.endsWith("/"))
			files.push({ name, data });
		p += 46 + nlen + xlen + clen;
	}
	return files;
}

function download(blob, name) {
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* Initial configuration: captured the first time, to restore presets later */
function snapshot() {
	try {
		return JSON.parse(localStorage.getItem("dnafx.initial"));
	} catch(e) {
		return null;
	}
}

function renderSnapshotInfo() {
	const snap = snapshot();
	const text = snap ? new Date(snap.date).toLocaleString("fr-FR") : "aucune";
	$("snapshot-info").textContent = "Config initiale : " + text;
	$("snapshot-date").textContent = text;
	$("restore-one").disabled = !snap;
	$("restore-all").disabled = !snap;
}

async function captureSnapshot() {
	const slots = Object.keys(state.presets).map(Number);
	if(slots.length !== 200) {
		log("Configuration initiale non capturée : seulement " + slots.length + " presets lus", true);
		return;
	}
	const snap = { date: new Date().toISOString(), presets: {} };
	const dir = backupDir() ? backupDir() + "/initial" : null;
	let fileErrors = 0;
	const res = await runBatch("Capture de la configuration initiale", slots.map(slot => ({ slot, label: "P" + pad3(slot) })), async ({ slot }) => {
		snap.presets[slot] = { name: state.presets[slot], bin: await getBinary(slot) };
		/* A copy on disk too (the folder must exist, it's fine if it doesn't) */
		if(dir && fileErrors === 0)
			await request("export-preset", [slot, "binary", dir + "/" + fileName(slot, state.presets[slot]) + ".bhb"]).catch(() => fileErrors++);
	});
	if(res.stopped || res.failures.length)
		return;
	try {
		localStorage.setItem("dnafx.initial", JSON.stringify(snap));
	} catch(e) {
		log("Impossible d'enregistrer la configuration initiale dans le navigateur : " + e.message, true);
		return;
	}
	renderSnapshotInfo();
	log("Configuration initiale capturée (200 presets)" + (dir && !fileErrors ? ", copie dans " + dir :
		dir ? " (pas de copie sur disque : crée le dossier " + dir + " pour en avoir une)" : ""));
}

/* Initial configuration from binary presets (e.g., the ones saved with -s) */
async function snapshotFromFiles(fileList) {
	const { bySlot } = await readPresetFiles(fileList);
	const bins = [...bySlot.values()].filter(p => p.bin);
	if(!bins.length)
		return log("Aucun preset binaire (.bhb) trouvé : la configuration initiale doit être exacte", true);
	const missing = [];
	for(let slot = 1; slot <= 200; slot++)
		if(!bySlot.get(slot)?.bin)
			missing.push(slot);
	if(!await ask("Définir la configuration initiale à partir de " + bins.length + " fichier(s) .bhb ?" +
			(missing.length ? "\nLes " + missing.length + " autres slots prendront l'état actuel du pédalier." : ""), "Définir"))
		return;
	const snap = { date: new Date().toISOString(), presets: {} };
	for(const p of bins)
		snap.presets[p.slot] = { name: p.name, bin: p.content };
	for(const slot of missing)
		snap.presets[slot] = { name: state.presets[slot], bin: await getBinary(slot) };
	localStorage.setItem("dnafx.initial", JSON.stringify(snap));
	renderSnapshotInfo();
	log("Configuration initiale définie depuis " + bins.length + " fichier(s)");
}

async function restoreOne() {
	const snap = snapshot(), slot = state.slot;
	if(!snap || !slot || !snap.presets[slot] || !await checkDirty())
		return;
	const initial = snap.presets[slot];
	if(sameBinary(await getBinary(slot), initial.bin))
		return log("P" + pad3(slot) + " est déjà dans sa configuration initiale");
	if(!await ask("Remettre P" + pad3(slot) + " « " + state.presets[slot] + " » dans sa configuration initiale (« " + initial.name + " ») ?", "Restaurer"))
		return;
	await writeSlot(slot, initial.bin);
	await request("change-preset", [slot]);
	await reloadAll();
	log("P" + pad3(slot) + " restauré (« " + initial.name + " »)");
}

async function restoreAll() {
	const snap = snapshot();
	if(!snap || !await checkDirty())
		return;
	const changed = [];
	await runBatch("Comparaison avec la configuration initiale", Object.keys(snap.presets).map(Number).map(slot => ({ slot, label: "P" + pad3(slot) })), async ({ slot }) => {
		if(!sameBinary(await getBinary(slot), snap.presets[slot].bin))
			changed.push(slot);
	});
	if(!changed.length)
		return log("Tous les presets sont dans leur configuration initiale");
	if(!await ask(changed.length + " preset(s) différent(s) de la configuration initiale seront restaurés :\n" +
			changed.slice(0, 15).map(s => "P" + pad3(s) + " " + state.presets[s] + " → " + snap.presets[s].name).join("\n") +
			(changed.length > 15 ? "\n…" : ""), "Restaurer"))
		return;
	await runBatch("Restauration", changed.map(slot => ({ slot, label: "P" + pad3(slot) + " " + snap.presets[slot].name })),
		({ slot }) => writeSlot(slot, snap.presets[slot].bin));
	await reloadAll();
	if(state.slot)
		request("change-preset", [state.slot]).catch(() => {});
}

/* Export and import of many presets at once */
async function exportAll() {
	const enc = new TextEncoder(), files = [];
	const slots = Object.keys(state.presets).map(Number);
	const res = await runBatch("Export des presets", slots.map(slot => ({ slot, label: "P" + pad3(slot) })), async ({ slot }) => {
		const name = fileName(slot, state.presets[slot]);
		const phb = await request("export-preset", [slot, "phb"]);
		files.push({ name: "phb/" + name + ".phb", data: enc.encode(JSON.stringify(phb, null, "\t")) });
		files.push({ name: "bhb/" + name + ".bhb", data: b64ToBytes(await getBinary(slot)) });
	});
	if(res.stopped || !files.length)
		return;
	download(makeZip(files), "dnafx-presets-" + timestamp() + ".zip");
	log(slots.length + " presets exportés (.phb pour l'app officielle, .bhb pour une copie exacte)");
}

/* Read presets from files (.phb, .bhb, or zips of them): the slot comes from
 * the number the name starts with (e.g., 015-BLACKNIGHT.phb), if any */
async function readPresetFiles(fileList) {
	let entries = [];
	for(const f of fileList) {
		const data = new Uint8Array(await f.arrayBuffer());
		if(/\.zip$/i.test(f.name))
			entries = entries.concat(await readZip(data.buffer));
		else
			entries.push({ name: f.name, data });
	}
	const bySlot = new Map(), dec = new TextDecoder(), errors = [];
	let next = state.slot || 1;
	for(const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const base = e.name.split("/").pop();
		const bin = /\.bhb$/i.test(base);
		if(!bin && !/\.(phb|json)$/i.test(base))
			continue;
		let content = null, name = null;
		if(bin) {
			if(e.data.length !== 184) {
				errors.push(base + " (taille)");
				continue;
			}
			content = bytesToB64(e.data);
			name = dec.decode(e.data.slice(1, 15)).trim();
		} else {
			try {
				const phb = JSON.parse(dec.decode(e.data));
				if(!phb.effectModule || !phb.fileInfo || !phb.Exp)
					throw new Error();
				name = phb.fileInfo.preset_name;
				content = JSON.stringify(phb);
			} catch(err) {
				errors.push(base + " (illisible)");
				continue;
			}
		}
		const m = base.match(/^(\d{1,3})[-_ .]/);
		let slot = m ? parseInt(m[1], 10) : 0;
		if(slot < 1 || slot > 200)
			slot = next++;
		/* With both a .bhb and a .phb for a slot (as in our zips), the binary is exact: keep that */
		const prev = bySlot.get(slot);
		if(!prev || bin || !prev.bin)
			bySlot.set(slot, { slot, bin, content, name, file: base });
	}
	return { bySlot, errors };
}

async function importFiles(fileList) {
	if(!await checkDirty())
		return;
	const { bySlot, errors } = await readPresetFiles(fileList);
	if(!bySlot.size)
		return log("Aucun preset trouvé" + (errors.length ? " (" + errors.join(", ") + ")" : ""), true);
	/* Skip what's already on the device */
	const todo = [];
	await runBatch("Comparaison avec le pédalier", [...bySlot.values()].map(p => ({ ...p, label: "P" + pad3(p.slot) })), async p => {
		if(p.bin) {
			if(!sameBinary(await getBinary(p.slot), p.content))
				todo.push(p);
		} else {
			const cur = await request("export-preset", [p.slot, "phb"]);
			if(JSON.stringify(cur.effectModule) !== JSON.stringify(JSON.parse(p.content).effectModule) ||
					JSON.stringify(cur.Exp) !== JSON.stringify(JSON.parse(p.content).Exp) ||
					cur.fileInfo.preset_name !== p.name)
				todo.push(p);
		}
	});
	todo.sort((a, b) => a.slot - b.slot);
	const same = bySlot.size - todo.length;
	if(!todo.length)
		return log("Rien à importer : les " + bySlot.size + " presets sont déjà identiques sur le pédalier");
	if(!await ask(todo.length + " preset(s) vont être écrits dans le pédalier" + (same ? " (" + same + " identique(s) ignoré(s))" : "") + " :\n" +
			todo.slice(0, 15).map(p => "P" + pad3(p.slot) + " " + (state.presets[p.slot] || "") + " ← " + p.name + " (" + p.file + ")").join("\n") +
			(todo.length > 15 ? "\n…" : "") + (errors.length ? "\n\nIgnorés : " + errors.join(", ") : ""), "Importer"))
		return;
	await runBatch("Import", todo.map(p => ({ ...p, label: "P" + pad3(p.slot) + " " + p.name })), p => writeSlot(p.slot, p.content));
	await reloadAll();
	if(state.slot)
		request("change-preset", [state.slot]).catch(() => {});
}

/* Moving presets around: swap two slots, or copy one over another */
async function movePreset(from, to, copy) {
	if(from === to || !state.presets[from] || !state.presets[to])
		return;
	if((from === state.slot || to === state.slot) && !await checkDirty())
		return;
	const a = "P" + pad3(from) + " « " + state.presets[from] + " »", b = "P" + pad3(to) + " « " + state.presets[to] + " »";
	if(!await ask(copy ? "Copier " + a + " à la place de " + b + " ?\n(" + b + " sera écrasé, une sauvegarde est faite avant)" :
			"Échanger " + a + " et " + b + " ?", copy ? "Copier" : "Échanger"))
		return;
	const binFrom = await getBinary(from), binTo = await getBinary(to);
	const items = [{ slot: to, bin: binFrom, label: "P" + pad3(to) }];
	if(!copy)
		items.push({ slot: from, bin: binTo, label: "P" + pad3(from) });
	const res = await runBatch(copy ? "Copie" : "Échange", items, it => writeSlot(it.slot, it.bin));
	if(res.failures.length)
		return reloadAll();
	state.original = null;
	state.current = null;
	await refreshPresets();
	await selectPreset(to);
	log(copy ? a + " copié en P" + pad3(to) : a + " et " + b + " échangés");
}

/* Events */
function step(delta) {
	const slots = Object.keys(state.presets).map(Number);
	const i = slots.indexOf(state.slot);
	if(i >= 0 && slots[i + delta])
		selectPreset(slots[i + delta]).catch(e => log(e.message, true));
}

$("prev-preset").onclick = () => step(-1);
$("next-preset").onclick = () => step(1);
$("send").onclick = () => send();
$("preset-name").oninput = e => {
	const clean = e.target.value.replace(/[^\x20-\x7e]/g, "").slice(0, 14);
	if(clean !== e.target.value)
		e.target.value = clean;
	state.current.fileInfo.preset_name = clean;
	changed();
};
$("preset-name").onkeydown = e => {
	if(e.key === "Enter")
		e.target.blur();
};
$("block-switch").onchange = e => setSwitch(section().name, e.target.checked);
$("auto-send").checked = setting("autoSend") === "1";
$("auto-send").onchange = e => {
	setting("autoSend", e.target.checked ? "1" : "0");
	if(e.target.checked)
		send();
};
$("export-phb").onclick = exportPhb;
const guard = fn => () => fn().catch(e => log(e.message, true));
$("restore-one").onclick = guard(restoreOne);
$("restore-all").onclick = guard(restoreAll);
$("export-all").onclick = guard(exportAll);
$("import-all").onclick = () => $("bulk-files").click();
$("bulk-files").onchange = e => {
	const files = [...e.target.files];
	e.target.value = "";
	if(files.length)
		importFiles(files).catch(err => log(err.message, true));
};
$("snapshot-files").onclick = () => $("snapshot-input").click();
$("snapshot-input").onchange = e => {
	const files = [...e.target.files];
	e.target.value = "";
	$("settings").close();
	if(files.length)
		snapshotFromFiles(files).catch(err => log(err.message, true));
};
$("recapture").onclick = async () => {
	$("settings").close();
	if(!await ask("Remplacer la configuration initiale par l'état actuel du pédalier ?", "Remplacer"))
		return;
	captureSnapshot().catch(e => log(e.message, true));
};
$("import-phb").onclick = () => $("phb-file").click();
$("phb-file").onchange = e => {
	if(e.target.files[0])
		importPhb(e.target.files[0]);
	e.target.value = "";
};
$("revert").onclick = () => {
	if(state.original) {
		state.current = clone(state.original);
		render();
		log("Modifications annulées");
	}
};
$("settings-button").onclick = () => {
	$("ws-url").value = setting("ws") || defaultWsUrl();
	$("backup-dir").value = setting("backupDir") ?? "backups";
	$("settings").showModal();
};
$("settings").onclose = () => {
	if($("settings").returnValue !== "ok")
		return;
	const url = $("ws-url").value.trim();
	const changedUrl = url !== (setting("ws") || defaultWsUrl());
	setting("ws", url);
	setting("backupDir", $("backup-dir").value.trim());
	if(changedUrl && ws)
		ws.close();
};
window.addEventListener("beforeunload", e => {
	if(isDirty())
		e.preventDefault();
});

/* Gradient for the knobs */
document.body.insertAdjacentHTML("beforeend",
	'<svg width="0" height="0" style="position:absolute"><defs><radialGradient id="knob-gradient" cx="40%" cy="35%" r="70%">' +
	'<stop offset="0" stop-color="#5a5c62"/><stop offset=".6" stop-color="#2b2c30"/><stop offset="1" stop-color="#1a1b1e"/>' +
	'</radialGradient></defs></svg>');

renderSnapshotInfo();
connect();
