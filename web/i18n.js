"use strict";

/*
 * Translations: the UI is written in English, and translated when the
 * browser uses one of the languages below (or with ?lang=xx in the URL).
 * Strings can contain placeholders ({0}, {1}...), filled by t().
 */
const TRANSLATIONS = {
	fr: {
		/* Page */
		"Previous preset": "Preset précédent",
		"Preset name (14 characters max)": "Nom du preset (14 caractères max)",
		"Next preset": "Preset suivant",
		"Send to the device": "Envoyer au pédalier",
		"Automatically send each change to the device": "Envoie automatiquement chaque modification au pédalier",
		"AUTO SEND": "ENVOI AUTO",
		"Connection to dnafx-editor": "Connexion à dnafx-editor",
		"Settings": "Réglages",
		"DEVICE": "PÉDALIER",
		"Drag: swap · Ctrl + drag: copy": "Glisser : échanger · Ctrl + glisser : copier",
		"THIS PRESET": "CE PRESET",
		"Import .phb": "Importer .phb",
		"Export .phb": "Exporter .phb",
		"Revert": "Annuler modifs",
		"Restore initial": "Restaurer initial",
		"Load a .phb file in the preset being edited (without sending it)": "Charger un fichier .phb dans le preset affiché (sans l'envoyer)",
		"Download the preset being edited as .phb": "Télécharger le preset affiché en .phb",
		"Revert the changes that were not sent": "Annuler les modifications non envoyées",
		"Restore this preset to its initial configuration": "Remettre ce preset dans sa configuration initiale",
		"ALL PRESETS": "TOUS LES PRESETS",
		"Export all": "Exporter tout",
		"Import…": "Importer…",
		"Restore the whole initial config": "Restaurer toute la config initiale",
		"Download all presets (.phb and .bhb) in a .zip": "Télécharger tous les presets (.phb et .bhb) dans un .zip",
		"Write presets (.zip, .phb, .bhb) to the device": "Écrire des presets (.zip, .phb, .bhb) dans le pédalier",
		"Restore all the modified presets to their initial configuration": "Remettre tous les presets modifiés dans leur configuration initiale",
		"Turn the section on / off": "Activer / désactiver le bloc",
		"Connect to dnafx-editor to start": "Connecte-toi à dnafx-editor pour commencer",
		"Backend address (WebSocket)": "Adresse du backend (WebSocket)",
		"Backups folder (on the dnafx-editor side)": "Dossier des sauvegardes (côté dnafx-editor)",
		"Before a preset is overwritten for the first time, the version on the device is saved as .bhb in this folder (relative to the folder dnafx-editor runs in). The folder must exist. Leave empty to disable backups.":
			"Avant le premier envoi de chaque preset, sa version présente sur le pédalier est sauvegardée en .bhb dans ce dossier (chemin relatif au dossier où tourne dnafx-editor). Le dossier doit exister. Laisser vide pour ne pas sauvegarder.",
		"Initial configuration:": "Configuration initiale :",
		"Replace with the current state of the device": "Remplacer par l'état actuel du pédalier",
		"Load from .bhb / .zip files": "Charger depuis des fichiers .bhb / .zip",
		"E.g., the .bhb files saved with dnafx-editor -s, or an exported zip": "Par exemple les .bhb sauvegardés avec dnafx-editor -s, ou un zip exporté",
		"Cancel": "Annuler",
		"Save": "Enregistrer",
		"Stop": "Arrêter",
		/* Connection */
		"Connecting…": "Connexion…",
		"Connected": "Connecté",
		"Disconnected": "Déconnecté",
		"Invalid backend address: {0}": "Adresse du backend invalide : {0}",
		"Connected to {0}": "Connecté à {0}",
		"Connection lost": "Connexion perdue",
		"Error {0}": "Erreur {0}",
		"Not connected to dnafx-editor": "Pas connecté à dnafx-editor",
		"No response to '{0}'": "Pas de réponse à '{0}'",
		/* Editing and sending */
		"The preset has changes that were not sent: discard them?": "Le preset affiché a des modifications non envoyées : les abandonner ?",
		"Discard": "Abandonner",
		"Could not back up the preset ({0}): {1}. Create the folder, or disable backups in the settings.":
			"Sauvegarde impossible ({0}) : {1}. Crée le dossier, ou désactive la sauvegarde dans les réglages.",
		"Previous version backed up: {0}": "Sauvegarde de l'ancienne version : {0}",
		"Preset {0} sent ({1} ms)": "Preset {0} envoyé ({1} ms)",
		"Could not send the preset: {0}": "Échec de l'envoi : {0}",
		"{0} (double click: on / off)": "{0} (double-clic : activer / désactiver)",
		"Range of values to be confirmed ({0}…{1})": "Plage de valeurs à confirmer ({0}…{1})",
		"Changes reverted": "Modifications annulées",
		/* Files */
		"Unreadable file: {0}": "Fichier illisible : {0}",
		"This file is not a .phb preset": "Ce fichier n'est pas un preset .phb",
		"Invalid preset ({0} section)": "Preset invalide (bloc {0})",
		"Imported: {0} (not sent yet)": "Importé : {0} (pas encore envoyé)",
		"invalid zip file": "fichier zip invalide",
		" (size)": " (taille)",
		" (unreadable)": " (illisible)",
		/* Batches */
		" (stopped)": " (arrêté)",
		", {0} failure(s): {1}": ", {0} échec(s) : {1}",
		/* Initial configuration */
		"none": "aucune",
		"Initial config: {0}": "Config initiale : {0}",
		"Initial configuration not captured: only {0} presets were read": "Configuration initiale non capturée : seulement {0} presets lus",
		"Capturing the initial configuration": "Capture de la configuration initiale",
		"Could not save the initial configuration in the browser: {0}": "Impossible d'enregistrer la configuration initiale dans le navigateur : {0}",
		"Initial configuration captured (200 presets)": "Configuration initiale capturée (200 presets)",
		", copy in {0}": ", copie dans {0}",
		" (no copy on disk: create the {0} folder to have one)": " (pas de copie sur disque : crée le dossier {0} pour en avoir une)",
		"No binary preset (.bhb) found: the initial configuration must be exact": "Aucun preset binaire (.bhb) trouvé : la configuration initiale doit être exacte",
		"Set the initial configuration from {0} .bhb file(s)?": "Définir la configuration initiale à partir de {0} fichier(s) .bhb ?",
		"The {0} other slots will take the current state of the device.": "Les {0} autres slots prendront l'état actuel du pédalier.",
		"Set": "Définir",
		"Initial configuration set from {0} file(s)": "Configuration initiale définie depuis {0} fichier(s)",
		"Replace the initial configuration with the current state of the device?": "Remplacer la configuration initiale par l'état actuel du pédalier ?",
		"Replace": "Remplacer",
		/* Restoring */
		"{0} is already in its initial configuration": "{0} est déjà dans sa configuration initiale",
		"Restore {0} to its initial configuration ({1})?": "Remettre {0} dans sa configuration initiale ({1}) ?",
		"Restore": "Restaurer",
		"{0} restored ({1})": "{0} restauré ({1})",
		"Comparing with the initial configuration": "Comparaison avec la configuration initiale",
		"All presets are in their initial configuration": "Tous les presets sont dans leur configuration initiale",
		"{0} preset(s) different from the initial configuration will be restored:": "{0} preset(s) différent(s) de la configuration initiale seront restaurés :",
		"Restoring": "Restauration",
		/* Export and import */
		"Exporting presets": "Export des presets",
		"{0} presets exported (.phb for the official editor, .bhb for an exact copy)": "{0} presets exportés (.phb pour l'app officielle, .bhb pour une copie exacte)",
		"No presets found": "Aucun preset trouvé",
		"Comparing with the device": "Comparaison avec le pédalier",
		"Nothing to import: the {0} presets are already the same on the device": "Rien à importer : les {0} presets sont déjà identiques sur le pédalier",
		"{0} preset(s) will be written to the device": "{0} preset(s) vont être écrits dans le pédalier",
		" ({0} identical skipped)": " ({0} identique(s) ignoré(s))",
		"Skipped: {0}": "Ignorés : {0}",
		"Import": "Importer",
		"Importing": "Import",
		/* Moving */
		"Copy {0} over {1}?\n({1} will be overwritten, after a backup)": "Copier {0} à la place de {1} ?\n({1} sera écrasé, une sauvegarde est faite avant)",
		"Swap {0} and {1}?": "Échanger {0} et {1} ?",
		"Copy": "Copier",
		"Swap": "Échanger",
		"Copying": "Copie",
		"Swapping": "Échange",
		"{0} copied to {1}": "{0} copié en {1}",
		"{0} and {1} swapped": "{0} et {1} échangés"
	}
};

const LANG = (new URLSearchParams(location.search).get("lang") || navigator.language || "en").slice(0, 2).toLowerCase();
const STRINGS = TRANSLATIONS[LANG] || {};

function t(text, ...args) {
	return (STRINGS[text] || text).replace(/\{(\d+)\}/g, (m, i) => args[i] !== undefined ? args[i] : m);
}

/* Preset names between quotes, as the language wants them */
function quote(text) {
	return LANG === "fr" ? "« " + text + " »" : "“" + text + "”";
}

/* Translate the static texts of the page (text and title attributes) */
function translatePage() {
	if(!TRANSLATIONS[LANG])
		return;
	document.documentElement.lang = LANG;
	const translate = text => {
		const key = text.replace(/\s+/g, " ").trim();
		return STRINGS[key] ? text.replace(/\S[\s\S]*\S|\S/, () => STRINGS[key]) : text;
	};
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	for(let node = walker.nextNode(); node; node = walker.nextNode())
		node.nodeValue = translate(node.nodeValue);
	for(const el of document.querySelectorAll("[title]"))
		el.title = translate(el.title);
}
