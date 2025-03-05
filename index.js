import mainURL from './mainURL.js';
import mainHAR from './mainHAR.js';

main(process.argv).catch(console.error);

async function main(argv) {
	if (argv.length < 3) {
		console.error('Usage: show-import-tree <url> [<JSESSIONID cookie>] [-d]');
		console.error('       show-import-tree <HAR file path>');
		process.exit(2);
	}

	const url = argv[2];

	if (url.toLowerCase().endsWith('.har')) {
		await mainHAR(argv);
	}
	else {
		await mainURL(argv);
	}
}
