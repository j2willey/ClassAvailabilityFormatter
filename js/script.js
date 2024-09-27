document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('fileInput');
    const classTables = document.getElementById('classTables');

    let classNum  = '';
    let className = '';
    let seatsTaken = '';
    let seatsOpen = '';
    let waitlisted = '';
    let block     = '';
    let location  = '';
    let netOpen   = '';
    let dateStamp = '';


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
            console.log("dateStamp: ", dateStamp);
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
        classNum  = locateColumn(df, ['Class #']);
        className = locateColumn(df, ['Class Name']);
        block     = locateColumn(df, ['Period']);
        location  = locateColumn(df, ['Room']);
        maxSeats  = locateColumn(df, ['Max', 'Class', 'Size']);
        seatsTaken = locateColumn(df, ['Nbr', 'Seats', 'Taken']);
        seatsOpen = locateColumn(df, ['Nbr', 'Seats', 'Open']);
        waitlisted = locateColumn(df, ['Wait', 'List', 'Count']);

        console.log("classNum: ", classNum  )
        console.log("className: ", className )
        console.log("block: ", block     )
        console.log("location: ", location  )
        console.log("maxSeats: ", maxSeats  )
        console.log("seatsTaken: ", seatsTaken)
        console.log("seatsOpen: ", seatsOpen )
        console.log("waitlisted: ", waitlisted)

        // create a new array of objects from df,
        // include only rows where column[classNum] matches "CHSM.*"
        // and include only columes block, className, seatsTaken, seatsOpen, waitlist, location,
        // as object properties. and add a new property netOpen = seatsOpen - waitlisted
        // remove parentheses and all text between them from className
        let blocks = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
        for (let i = 0; i < df.length; i++) {
            console.log("i: ", i, "   line: ", df[i]);
            if (df[i][classNum] && df[i][classNum].match(/CHSM.*/)) {
            let cleanedClassName = df[i][className].replace(/\s*\(.*?\)\s*/g, ' ').trim();
            // parse the block number from the block column, which is a string like "Block 1"
            // and convert it to a number
            let blockNumber = parseInt(df[i][block].match(/\d+/)[0], 10);
            console.log("blockNumber: ", blockNumber, "className: ", cleanedClassName);
            let c = {
                block: df[i][block],
                className: cleanedClassName,
                seatsTaken: df[i][seatsTaken],
                seatsOpen: df[i][seatsOpen],
                waitlisted: df[i][waitlisted],
                location: df[i][location],
                netOpen: df[i][seatsOpen] - df[i][waitlisted]
            };
            blocks[blockNumber].push(c);
            }
        }
        console.log(blocks);
        // sort classes for each block by netOpen, descending, then by className, ascending
        // FIXME: this is not working
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
        return blocks;
    }


    function displayTable(block, classes) {
        const week = document.getElementById('weekSelect').value;
        const tableContainer = document.createElement('div')
        tableContainer.classList.add('tableContainer');

        const titleContainer = document.createElement('div');
        titleContainer.classList.add('titleContainer');

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
        const columns = [/*'block',*/ 'className', 'location', 'netOpen', 'seatsTaken', 'seatsOpen', 'waitlisted'];

        console.log(`displayTable  ${block}: ${classes.length}\n`);
        tableHeader.innerHTML = '';

        const tr = document.createElement('tr');
        for (const col of columns) {
            const td = document.createElement('td');
            td.textContent = col;
            td.classList.add('columnHeader');
            // tableHeader.appendChild(td);
            tr.appendChild(td);
        }
        // tableHeader.appendChild(ttitle);
        tableHeader.appendChild(tr);
        tableBody.innerHTML = '';

        if (classes.length > 0) {
            console.log(`displayTable inside  ${block}\n`);
            for (let i = 1; i < classes.length; i++) {
                console.log(classes['className']);
                const row = classes[i];
                const tr = document.createElement('tr');
                if (row.netOpen > 0) {
                    tr.classList.add('highlight');
                }

                columns.forEach(col => {
                    const td = document.createElement('td');
                    td.textContent = row[col];
                    tr.appendChild(td);
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

    function csvToTable(text) {
        let df = CSVtoArray(text);
        let blocks = consolodateClassInfo(df);
        for (let block in blocks) {
            displayTable(block, blocks[block]);
        }
    }

});