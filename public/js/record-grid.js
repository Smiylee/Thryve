(() => {
  const grid = document.getElementById('record-grid');
  if (!grid) return;
  const body = grid.tBodies[0], status = document.getElementById('grid-status');
  const deletedRows = [];
  let dirty = false, saving = false;
  const columns = () => [...grid.tHead.rows[0].querySelectorAll('[data-column]')];
  const settings = col => document.getElementById(`column-setting-${col.dataset.column}`);
  function changed() { dirty = true; status.classList.remove('error'); status.textContent = 'Changes not saved yet. Press Save changes when you finish.'; }
  function renumber() {
    [...body.rows].forEach((row, i) => {
      row.cells[0].textContent = i + 1;
      [...row.querySelectorAll('input,select')].forEach((input, c) => input.setAttribute('aria-label', `${settings(columns()[c]).querySelector('.column-name').value}, row ${i + 1}`));
    });
    document.getElementById('grid-empty').hidden = !!body.rows.length;
  }
  function addRow() {
    const row = body.insertRow();
    row.insertCell().textContent = body.rows.length;
    for (const col of columns()) {
      const cell = row.insertCell(), input = document.createElement(col.dataset.type === 'BOOLEAN' ? 'select' : 'input');
      if (col.dataset.type === 'BOOLEAN') {
        for (const [value, label] of [['',''],['true','Yes'],['false','No']]) input.add(new Option(label, value));
      } else { input.type = col.dataset.type === 'NUMBER' ? 'number' : col.dataset.type === 'DATE' ? 'date' : 'text'; input.step = 'any'; }
      cell.append(input);
    }
    const button = document.createElement('button'); button.type = 'button'; button.className = 'remove-grid-row secondary'; button.textContent = 'Delete row'; const actions = row.insertCell(); actions.className = 'row-actions'; actions.append(button);
    renumber(); changed(); return row;
  }
  document.querySelector('.spreadsheet').addEventListener('input', event => { if (event.target.id !== 'grid-search') changed(); });
  document.getElementById('sheet-options').addEventListener('toggle', event => { document.querySelector('.spreadsheet').classList.toggle('sheet-options-open', event.target.open); });
  document.getElementById('new-row').addEventListener('click', () => { document.getElementById('grid-search').value = ''; [...body.rows].forEach(r => r.hidden = false); addRow().querySelector('input,select')?.focus(); });
  document.querySelector('.spreadsheet').addEventListener('click', event => {
    if (event.target.closest('.remove-grid-row')) {
      const row = event.target.closest('tr');
      if (!confirm('Delete this row when you save changes?')) return;
      if (row.dataset.row) deletedRows.push(Number(row.dataset.row));
      row.remove(); renumber(); changed();
    }
    if (event.target.closest('.remove-grid-column')) {
      if (columns().length <= 1) { status.textContent = 'Keep at least one column.'; return; }
      if (!confirm('Delete this column and its values when you save changes?')) return;
      const column = columns().find(col => col.dataset.column === event.target.dataset.columnId);
      const index = column.cellIndex;
      settings(column).remove();
      [...grid.rows].forEach(row => row.deleteCell(index)); renumber(); changed();
    }
  });
  grid.addEventListener('paste', event => {
    const input = event.target.closest('td input,td select');
    const text = event.clipboardData?.getData('text/plain');
    if (!input || !text || (!text.includes('\t') && !text.includes('\n'))) return;
    event.preventDefault();
    const startRow = input.closest('tr').sectionRowIndex, startCol = input.closest('td').cellIndex;
    const pasted = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(line => line.split('\t'));
    if (startRow + pasted.length > 1000 || pasted.some(values => startCol + values.length > columns().length + 1)) { status.textContent = 'Paste up to 1,000 rows, and add enough columns first.'; return; }
    pasted.forEach((values, r) => {
      while (body.rows.length <= startRow + r) addRow();
      values.forEach((value, c) => {
        const target = body.rows[startRow + r].cells[startCol + c].querySelector('input,select');
        if (target.tagName === 'SELECT') value = ({yes:'true',no:'false',true:'true',false:'false','':''})[value.toLowerCase()] ?? value;
        // Keep invalid date/number data from being silently erased by native inputs.
        if (target.tagName === 'INPUT' && ['date','number'].includes(target.type)) target.type = 'text';
        if (target.tagName === 'SELECT' && ![...target.options].some(o => o.value === value)) target.add(new Option(value, value));
        target.value = value;
      });
    }); changed();
  });
  document.getElementById('grid-search').addEventListener('input', event => {
    const query = event.target.value.toLowerCase();
    [...body.rows].forEach(row => row.hidden = ![...row.querySelectorAll('input,select')].some(input => (input.tagName === 'SELECT' ? input.selectedOptions[0]?.text : input.value).toLowerCase().includes(query)));
  });
  document.getElementById('save-grid').addEventListener('click', async () => {
    if (saving) return;
    const button = document.getElementById('save-grid');
    const fields = columns().map(col => ({id: Number(col.dataset.column), type: col.dataset.type, name: settings(col).querySelector('.column-name').value, required: settings(col).querySelector('[type=checkbox]').checked}));
    const rows = [...body.rows].map(row => Object.assign({id: row.dataset.row ? Number(row.dataset.row) : null}, ...[...row.querySelectorAll('input,select')].map((input, i) => ({[`field_${fields[i].id}`]: input.value}))));
    saving = true; button.disabled = true; status.textContent = 'Saving…';
    // Lock editing during the request so a successful reload cannot lose newer edits.
    const controls = [...document.querySelectorAll('.spreadsheet input,.spreadsheet select,.spreadsheet button,#add-fields-form button')];
    controls.forEach(control => control.disabled = true);
    try {
      const response = await fetch(`/admin/record-books/${document.querySelector('.spreadsheet').dataset.bookId}/grid`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:document.getElementById('book-name').value, columns:fields, rows, deletedRows})});
      if (response.redirected) throw new Error('Your session has expired. Sign in in another tab, then save again.');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save. Try again.');
      dirty = false; sessionStorage.setItem('record-book-saved', document.querySelector('.spreadsheet').dataset.bookId); location.reload();
    } catch (error) { status.classList.add('error'); status.textContent = error.message; }
    finally { saving = false; controls.forEach(control => control.disabled = false); }
  });
  document.getElementById('add-fields-form').addEventListener('submit', event => {
    if (dirty) { event.preventDefault(); status.textContent = 'Save your grid changes before adding columns.'; }
  });
  document.getElementById('export-grid').addEventListener('click', () => {
    const quote = value => { value = String(value); if (/^[=+@\-\t\r]/.test(value)) value = "'" + value; return '"' + value.replaceAll('"','""') + '"'; };
    const data = [columns().map(c => settings(c).querySelector('.column-name').value), ...[...body.rows].map(r => [...r.querySelectorAll('input,select')].map(input => input.value))];
    const url = URL.createObjectURL(new Blob(['\ufeff' + data.map(row => row.map(quote).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'record-book.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  if (sessionStorage.getItem('record-book-saved') === document.querySelector('.spreadsheet').dataset.bookId) {
    status.textContent = 'Your changes have been saved.';
    sessionStorage.removeItem('record-book-saved');
  }
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
})();
