export function indentLog(indent, ...things) {
	for(let i=0; i<indent; i++) {
		process.stdout.write('  ');//'| ');
	}

	console.log(...things);
}
