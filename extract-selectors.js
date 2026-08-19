const fs = require('fs');
const csstree = require('css-tree');

// 1. Point to your specific CSS file path
const cssFilePath = './css/raw-mfl.css';
const outputCsvPath = './css/extracted_selectors.csv';

console.log('Reading CSS file...');
const css = fs.readFileSync(cssFilePath, 'utf8');

console.log('Parsing CSS (this might take a few seconds for 14,000+ lines)...');
const ast = csstree.parse(css);

// 2. Create "Sets" to hold unique values (Sets automatically remove duplicates)
const classes = new Set();
const ids = new Set();

// 3. Walk through the parsed code to find Classes and IDs
csstree.walk(ast, (node) => {
    if (node.type === 'ClassSelector') {
        classes.add(node.name);
    } else if (node.type === 'IdSelector') {
        ids.add(node.name);
    }
});

// 4. Sort the lists alphabetically for easier reading
const sortedClasses = Array.from(classes).sort();
const sortedIds = Array.from(ids).sort();

// 5. Build the CSV content
let csvContent = "Type,Selector Name\n";

sortedClasses.forEach(className => {
    csvContent += `Class,.${className}\n`;
});

sortedIds.forEach(idName => {
    csvContent += `ID,#${idName}\n`;
});

// 6. Save the new CSV file
fs.writeFileSync(outputCsvPath, csvContent, 'utf8');

console.log('-----------------------------------');
console.log(`Success! Found ${sortedClasses.length} unique classes and ${sortedIds.length} unique IDs.`);
console.log(`Your master list has been saved to: ${outputCsvPath}`);