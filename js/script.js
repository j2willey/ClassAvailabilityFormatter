document.addEventListener('DOMContentLoaded', function() {
    const advancedOptionsToggle = document.getElementById('advancedOptionsToggle');

    const fileInput = document.getElementById('fileInput');
    const classTables = document.getElementById('classTables');
    let blocks = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    let dateStamp = '';

    // classMetadata object
    const cm = {
        classNum   : { reportSignature : ['Class #'],               dfCol : '', display : false, dpOrder : 0, dpVal : 'Class #'},
        className  : { reportSignature : ['Class Name'],            dfCol : '', display : true,  dpOrder : 1, dpVal : 'Class Name'},
        block      : { reportSignature : ['Period'],                dfCol : '', display : false, dpOrder : 2, dpVal : 'Block'},
        location   : { reportSignature : ['Room'],                  dfCol : '', display : true,  dpOrder : 3, dpVal : 'Location'},
        maxSeats   : { reportSignature : ['Max', 'Class', 'Size'],  dfCol : '', display : false, dpOrder : 4, dpVal : 'Max Spots'},
        seatsTaken : { reportSignature : ['Nbr', 'Seats', 'Taken'], dfCol : '', display : true,  dpOrder : 5, dpVal : 'Spots Taken'},
        seatsOpen  : { reportSignature : ['Nbr', 'Seats', 'Open'],  dfCol : '', display : true,  dpOrder : 6, dpVal : 'Open Spots'},
        waitlisted : { reportSignature : ['Wait', 'List', 'Count'], dfCol : '', display : true,  dpOrder : 7, dpVal : 'Wait listed'},
        netOpen    : { reportSignature : [],                        dfCol : '', display : true,  dpOrder : 8, dpVal : 'Net Open Spots'}
    }

    console.log("cm: ", cm);

    // Show/Hide advanced options
    advancedOptionsToggle.addEventListener('click', function() {
        const advancedOptions = document.getElementById('advancedOptions');
        advancedOptions.classList.add('dontprint');
        if (advancedOptionsToggle.checked) {
            advancedOptions.style.display = 'block';
        } else {
            advancedOptions.style.display = 'none';
        }
        advancedOptions.innerHTML = "";
        for (const key in cm) {
            const row = document.createElement('div');
            row.classList.add('dontprint');
            const label = document.createElement('label');
            label.textContent = cm[key].dpVal;
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = key;
            input.checked = cm[key].display;
            row.appendChild(label);
            row.appendChild(input);
            advancedOptions.appendChild(row);
        }
        const className = document.getElementById('className');
        className.disabled = true;

    });

    advancedOptions.addEventListener('click', function(event) {
        console.log("Event target: ", event.target);
        if (event.target.type === 'checkbox') {
            const key = event.target.id;
            cm[key].display = event.target.checked;
            console.log("cm[key]: ", cm[key]);
            displayTables(blocks);
        }
    });


    fileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        classTables.innerHTML = '';
        if (file) {
            const reader = new FileReader();
            const fileType = file.name.split('.').pop().toLowerCase();

            if (fileType === 'csv') {
                reader.onload = function(e) {
                    const csv = e.target.result;
                    csvToTable(csv);
                };
                reader.readAsText(file);
            } else if (fileType === 'xls' || fileType === 'xlsx') {
                reader.onload = function(e) {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const csv = XLSX.utils.sheet_to_csv(worksheet);
                    csvToTable(csv);
                };
                reader.readAsArrayBuffer(file);
            } else {
                alert('Unsupported file type');
            }
            // set the dateStamp to the file's last modified date
            dateStamp = file.lastModifiedDate.toLocaleDateString();
        }
    });


    function CSVtoArray(text) {
        const classes = text.split('\n');
        const rows = classes.map(line => {
            const row = [];
            let insideQuote = false;
            let cell = '';
            for (let i = 0; i < line.length; i++) {
                if (line[i] === '"') {
                    insideQuote = !insideQuote;
                } else if (line[i] === ',' && !insideQuote) {
                    row.push(cell);
                    cell = '';
                } else {
                    cell += line[i];
                }
            }
            row.push(cell);
            return row;
        });
        return rows;

    }

    function locateColumn(df, colName) {
        // colName is a list of strings found vertically starting any row.
        for (let colIndex = 0; colIndex < df[0].length; colIndex++) {
            for (let rowIndex = 0; rowIndex <= df.length - colName.length; rowIndex++) {
                let found = true;
                for (let i = 0; i < colName.length; i++) {
                    if (df[rowIndex + i][colIndex] !== colName[i]) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    return colIndex;
                }
            }
        }
        return -1;
    }

    function consolodateClassInfo(df) {
        cm.classNum.dfCol   = locateColumn(df, cm.classNum.reportSignature);
        cm.className.dfCol  = locateColumn(df, cm.className.reportSignature);
        cm.block.dfCol      = locateColumn(df, cm.block.reportSignature);
        cm.location.dfCol   = locateColumn(df, cm.location.reportSignature);
        cm.maxSeats.dfCol   = locateColumn(df, cm.maxSeats.reportSignature);
        cm.seatsTaken.dfCol = locateColumn(df, cm.seatsTaken.reportSignature);
        cm.seatsOpen.dfCol  = locateColumn(df, cm.seatsOpen.reportSignature);
        cm.waitlisted.dfCol = locateColumn(df, cm.waitlisted.reportSignature);

        // for each cm property, print the column index aka dfCol
        Object.keys(cm).forEach(key => {
            console.log(`df Column index for ${key}: ${cm[key].dfCol}`);
        });

        // create a new array of objects from df,
        // include only rows where column[classNum] matches "CHSM.*"
        // and include only specified columns as object properties,
        // and add a new property netOpen = seatsOpen - waitlisted
        // remove parentheses and all text between them from className
        blocks = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
        for (let i = 0; i < df.length; i++) {
            if (df[i][cm.classNum.dfCol] && df[i][cm.classNum.dfCol].match(/CHSM.*/)) {
                let cleanedClassName = df[i][cm.className.dfCol].replace(/\s*\(.*?\)\s*/g, ' ').trim();
                let blockNumber = parseInt(df[i][cm.block.dfCol].match(/\d+/)[0], 10);
                let c = {
                    classNum: df[i][cm.classNum.dfCol],
                    block: df[i][cm.block.dfCol],
                    className: cleanedClassName,
                    maxSeats: df[i][cm.maxSeats.dfCol],
                    seatsTaken: df[i][cm.seatsTaken.dfCol],
                    seatsOpen: df[i][cm.seatsOpen.dfCol],
                    waitlisted: df[i][cm.waitlisted.dfCol],
                    location: df[i][cm.location.dfCol],
                    netOpen: df[i][cm.seatsOpen.dfCol] - df[i][cm.waitlisted.dfCol]
                };
                blocks[blockNumber].push(c);
            }
        }

        // sort classes for each block by netOpen, descending, then by className, ascending
        for (let bn in blocks) {
            blocks[bn].sort((a, b) => {
                if (a.netOpen > b.netOpen) {
                    return -1;
                } else if (a.netOpen < b.netOpen) {
                    return 1;
                } else {
                    if (a.className < b.className) {
                        return -1;
                    } else if (a.className > b.className) {
                        return 1;
                    } else {
                        return 0;
                    }
                }
            })
        }
        console.log(`blocks: ${blocks}`);
        return blocks;
    }

    function getColumnNamesSortedByDpOrder(cm) {
        return Object.keys(cm)
            .sort((a, b) => cm[a].dpOrder - cm[b].dpOrder)
            .map(key => key);
    }

    function displayTable(block, classes) {
        const week = document.getElementById('weekSelect').value;
        const tableContainer = document.createElement('div');
        tableContainer.classList.add('tableContainer');

        const titleContainer = document.createElement('div');
        titleContainer.classList.add('titleContainer');
        titleContainer.classList.add("headline");
        const blockE = document.createElement('span');
        blockE.textContent = "Block " + block + "   ";
        const weekE = document.createElement('span');
        weekE.textContent = week;
        const dateE = document.createElement('span');
        dateE.textContent = "Updated: " + dateStamp;

        titleContainer.appendChild(blockE);
        titleContainer.appendChild(weekE);
        titleContainer.appendChild(dateE);

        const table = document.createElement('table')
        const tableHeader = document.createElement('thead')
        const tableBody = document.createElement('tbody')
        table.appendChild(tableHeader);
        table.appendChild(tableBody);

        //create a list of column names from the cm object, sorted by dpOrder
        const columns = getColumnNamesSortedByDpOrder(cm);

        console.log(`displayTable  ${block}: ${classes.length}\n`);
        tableHeader.innerHTML = '';

        const tr = document.createElement('tr');
        for (const col of columns) {
            console.log(`displayTable inside  ${block}: ${col} ${cm[col]}\n`);
            if(cm[col].display) {
                const td = document.createElement('td');
                td.textContent = cm[col].dpVal;
                td.classList.add('columnHeader');
                td.classList.add(col);
                tr.appendChild(td);
            }
        }
        tableHeader.classList.add('headline');
        tableHeader.appendChild(tr);
        tableBody.innerHTML = '';

        if (classes.length > 0) {
            console.log(`displayTable inside  ${block}\n`);
            for (let i = 1; i < classes.length; i++) {
                console.log(`classes['className'] ${classes['className']}`);
                const row = classes[i];
                const tr = document.createElement('tr');
                if (row.netOpen > 0) {
                    tr.classList.add('highlight');
                }

                columns.forEach(col => {
                    if(cm[col].display) {
                        const td = document.createElement('td');
                        td.classList.add(col);
                        td.textContent = row[col];
                        tr.appendChild(td);
                    }
                });
                tableBody.appendChild(tr);
            }
        }
        tableContainer.appendChild(titleContainer);
        tableContainer.appendChild(table);
        classTables.appendChild(tableContainer);
        const div = document.createElement('div', {class: 'blockbreak'});
        div.classList.add('blockbreak');
        classTables.appendChild(div);

    }

    function displayTables(blocks) {
        classTables.innerHTML = '';
        for (let block in blocks) {
            displayTable(block, blocks[block]);
        }
    }

    function csvToTable(text) {
        let df = CSVtoArray(text);
        let blocks = consolodateClassInfo(df);
        displayTables(blocks);
    }

});