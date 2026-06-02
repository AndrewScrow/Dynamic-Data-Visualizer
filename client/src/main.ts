import Papa from 'papaparse';
import Chart from 'chart.js/auto';
import { jsPDF } from "jspdf";
import type { ChartType } from 'chart.js';

const csvInput = document.getElementById('csvInput') as HTMLInputElement;
const xAxisSelect = document.getElementById('xAxisSelect') as HTMLSelectElement;
const yAxisCheckboxes = document.getElementById('yAxisCheckboxes') as HTMLDivElement;
const chartTypeSelect = document.getElementById('chartType') as HTMLSelectElement;
const btnRender = document.getElementById('btnRender') as HTMLButtonElement;
const tableHead = document.querySelector('#dataTable thead') as HTMLTableSectionElement;
const tableBody = document.querySelector('#dataTable tbody') as HTMLTableSectionElement;
const canvas = document.getElementById('myChart') as HTMLCanvasElement;
const chartTitleInput = document.getElementById('chartTitleInput') as HTMLInputElement;
const btnExport = document.getElementById('btnExport') as HTMLButtonElement;
const btnCreateNew = document.getElementById('btnCreateNew') as HTMLButtonElement;
const btnAddRow = document.getElementById('btnAddRow') as HTMLButtonElement;
const btnExportCSV = document.getElementById('btnExportCSV') as HTMLButtonElement;
const btnAddColumn = document.getElementById('btnAddColumn') as HTMLButtonElement;
const exportFormat = document.getElementById('exportFormat') as HTMLSelectElement;

let parsedData: any[] = [];
let headers: string[] = [];
let chartInstance: Chart | null = null;

csvInput.addEventListener('change', (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const fileNameSpan = document.getElementById('fileNameSpan');
  if (fileNameSpan) fileNameSpan.textContent = file.name;

  Papa.parse(file, {
    header: true, 
    skipEmptyLines: true,
    complete: (results) => {
      parsedData = results.data;
      headers = results.meta.fields || [];
      
      console.log("Дані завантажено:", parsedData);

      populateSelects();
      renderTablePreview();
    },
    error: (error: any) => {
      alert('Помилка читання CSV: ' + error.message);
    }
  });
});

function populateSelects() {
  const previousX = xAxisSelect.value;

  const previousSelections = new Set(
    Array.from(document.querySelectorAll('.y-axis-checkbox:checked'))
      .map(cb => (cb as HTMLInputElement).value)
  );

  const previousColors: {[key: string]: string} = {};
  document.querySelectorAll('.y-axis-checkbox').forEach(cb => {
    const val = (cb as HTMLInputElement).value;
    const colorPicker = cb.nextElementSibling as HTMLInputElement;
    previousColors[val] = colorPicker.value;
  });

  xAxisSelect.innerHTML = '';
  yAxisCheckboxes.innerHTML = ''; 
  xAxisSelect.disabled = false;

  if (selectAllY) {
    selectAllY.disabled = false;
  }

  const defaultColors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6610f2'];

  headers.forEach((header, index) => {
    const optionX = document.createElement('option');
    optionX.value = header;
    optionX.textContent = header;
    xAxisSelect.appendChild(optionX);

    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '8px'; 
    label.style.marginBottom = '5px';
    label.style.cursor = 'pointer';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = header;
    checkbox.className = 'y-axis-checkbox';

    if (previousSelections.has(header)) {
      checkbox.checked = true;
    }

    checkbox.addEventListener('change', () => {
      const allCheckboxes = Array.from(document.querySelectorAll('.y-axis-checkbox')) as HTMLInputElement[];
      selectAllY.checked = allCheckboxes.every(cb => cb.checked);
      if (chartInstance) btnRender.click(); 
    });

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'y-axis-color';

    colorPicker.value = previousColors[header] || defaultColors[index % defaultColors.length]; 
    
    colorPicker.style.cursor = 'pointer';
    colorPicker.style.padding = '0';
    colorPicker.style.border = 'none';
    colorPicker.style.width = '25px';
    colorPicker.style.height = '25px';

    colorPicker.addEventListener('input', () => {
      if (chartInstance && checkbox.checked) {
        btnRender.click(); 
      }
    });

    const textSpan = document.createElement('span');
    textSpan.textContent = header;

    label.appendChild(checkbox);
    label.appendChild(colorPicker); 
    label.appendChild(textSpan);
    yAxisCheckboxes.appendChild(label);
  });

  if (headers.includes(previousX)) {
    xAxisSelect.value = previousX;
  }

  const allCheckboxes = Array.from(document.querySelectorAll('.y-axis-checkbox')) as HTMLInputElement[];
  if (allCheckboxes.length > 0) {
    selectAllY.checked = allCheckboxes.every(cb => cb.checked);
  }
}
function renderTablePreview() {
  tableHead.innerHTML = '';
  tableBody.innerHTML = '';

  const trHead = document.createElement('tr');

  const thAction = document.createElement('th');
  thAction.style.width = '30px';
  thAction.style.backgroundColor = '#e2e8f0';
  thAction.style.position = 'sticky';
  thAction.style.left = '0';
  thAction.style.zIndex = '12'; 
  trHead.appendChild(thAction);
  
  headers.forEach((header, colIndex) => {
    const th = document.createElement('th');
    th.style.backgroundColor = '#e2e8f0';
    
    const thContainer = document.createElement('div');
    thContainer.style.display = 'flex';
    thContainer.style.justifyContent = 'space-between';
    thContainer.style.alignItems = 'center';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = header;
    titleSpan.contentEditable = 'true';
    titleSpan.style.cursor = 'text';
    titleSpan.title = 'Натисніть, щоб змінити назву';

    titleSpan.addEventListener('blur', (e: Event) => {
      const target = e.target as HTMLElement;
      const newHeaderName = target.innerText.trim();
      const oldHeaderName = headers[colIndex];

      if (newHeaderName && newHeaderName !== oldHeaderName) {
        if (headers.includes(newHeaderName)) {
          alert('Стовпчик з такою назвою вже існує!');
          target.innerText = oldHeaderName;
          return;
        }
        headers[colIndex] = newHeaderName;
        parsedData.forEach(row => {
          row[newHeaderName] = row[oldHeaderName];
          delete row[oldHeaderName];
        });
        populateSelects();
        renderTablePreview();
        if (chartInstance) btnRender.click();
      } else {
         target.innerText = oldHeaderName;
      }
    });

    const deleteColBtn = document.createElement('span');
    deleteColBtn.innerHTML = '&#10006;'; 
    deleteColBtn.style.color = '#dc3545'; 
    deleteColBtn.style.cursor = 'pointer';
    deleteColBtn.style.marginLeft = '15px';
    deleteColBtn.title = 'Видалити стовпчик';
    
    deleteColBtn.addEventListener('click', () => {
      if (headers.length <= 1) {
        alert('Таблиця повинна мати хоча б один стовпчик!');
        return;
      }
      headers.splice(colIndex, 1);
      parsedData.forEach(row => {
        delete row[header];
      });
      populateSelects();
      renderTablePreview();
      if (chartInstance) btnRender.click();
    });

    thContainer.appendChild(titleSpan);
    thContainer.appendChild(deleteColBtn);
    th.appendChild(thContainer);
    trHead.appendChild(th);
  });

  tableHead.appendChild(trHead);

  parsedData.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');

    const tdAction = document.createElement('td');
    tdAction.style.textAlign = 'center';
    tdAction.style.backgroundColor = '#ffffff';
    tdAction.style.position = 'sticky';
    tdAction.style.left = '0';
    tdAction.style.zIndex = '2'; 
    
    const deleteRowBtn = document.createElement('span');
    deleteRowBtn.innerHTML = '&#10006;';
    deleteRowBtn.style.color = '#dc3545';
    deleteRowBtn.style.cursor = 'pointer';
    deleteRowBtn.title = 'Видалити рядок';
    
    deleteRowBtn.addEventListener('click', () => {
      parsedData.splice(rowIndex, 1); 
      renderTablePreview();
      if (chartInstance) btnRender.click();
    });

    tdAction.appendChild(deleteRowBtn);
    tr.appendChild(tdAction); 

    headers.forEach(header => {
      const td = document.createElement('td');
      td.textContent = row[header] !== undefined ? row[header] : '';
      td.contentEditable = 'true';
      td.style.cursor = 'text';
      
      td.dataset.row = rowIndex.toString();
      td.dataset.col = header;

      td.addEventListener('blur', (e: Event) => {
        const target = e.target as HTMLElement;
        const rIndex = parseInt(target.dataset.row!);
        const cName = target.dataset.col!;
        parsedData[rIndex][cName] = target.innerText;
        if (chartInstance) btnRender.click(); 
      });

      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });

  if (parsedData.length > 0) {
    btnAddRow.style.display = 'inline-block';
    btnAddColumn.style.display = 'inline-block';
    btnExportCSV.style.display = 'inline-block';
  }
}

btnRender.addEventListener('click', () => {
  if (parsedData.length === 0) {
    alert("Спочатку завантажте файл!");
    return;
  }

  const type = chartTypeSelect.value; 

  let chartJsType = type;
  if (type === 'area') chartJsType = 'line';
  if (type === 'stackedBar') chartJsType = 'bar';

  const isStacked = type === 'stackedBar';

  const xKey = xAxisSelect.value;
  const customTitle = chartTitleInput ? chartTitleInput.value.trim() : '';

  const checkedBoxes = Array.from(document.querySelectorAll('.y-axis-checkbox:checked')) as HTMLInputElement[];

  const labels = parsedData.map(row => row[xKey]);

  const datasets = checkedBoxes.map((checkbox) => {
    const yKey = checkbox.value;
    const colorPicker = checkbox.nextElementSibling as HTMLInputElement;
    const color = colorPicker.value;

    let bgColors: string | string[] = color + '55'; 
    let borderColors: string | string[] = color; 

    if (type === 'pie' || type === 'doughnut' || type === 'polarArea') {
      const pieColors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#EA6B66', '#73C0DE', '#3BA272', '#FC8452'];
      bgColors = labels.map((_, index) => pieColors[index % pieColors.length] + 'CC');
      borderColors = labels.map((_, index) => pieColors[index % pieColors.length]);
    }

    if (type === 'radar') {
      bgColors = color + '22';
    }

    let chartData: any[];
    if (type === 'scatter' || type === 'bubble') {
      chartData = parsedData.map((row, index) => {
        const xValue = parseFloat(row[xKey]);
        const finalX = isNaN(xValue) ? index + 1 : xValue; 
        const yValue = parseFloat(row[yKey]) || 0;
        const rValue = type === 'bubble' ? Math.floor(Math.random() * 15) + 5 : undefined; 
        return type === 'bubble' ? { x: finalX, y: yValue, r: rValue } : { x: finalX, y: yValue };
      });
    } else {
      chartData = parsedData.map(row => parseFloat(row[yKey]) || 0);
    }

    return {
      label: yKey,
      data: chartData,
      borderWidth: 2,
      backgroundColor: bgColors,
      borderColor: borderColors,
      tension: 0.3,
      fill: type === 'area' ? 'origin' : false 
    };
  });

  renderChart(labels, datasets, chartJsType, customTitle, isStacked);
});

function renderChart(labels: string[], datasets: any[], type: string, titleText: string, isStacked: boolean = false) {
  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(canvas, {
    type: type as any, 
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: titleText !== '',
          text: titleText,
          font: { size: 18 }
        }
      },
      scales: {
        x: { stacked: isStacked },
        y: { beginAtZero: true, stacked: isStacked }
      }
    }
  });
}

const historyList = document.getElementById('historyList') as HTMLUListElement;
const selectAllY = document.getElementById('selectAllY') as HTMLInputElement;
async function fetchHistory() {
  try {
    const response = await fetch('http://localhost:3000/api/history');
    const history = await response.json();
    
    historyList.innerHTML = '';
    history.forEach((item: any) => {
      const li = document.createElement('li');
      li.textContent = `${item.uploadDate} - ${item.originalName}`;
      li.style.marginBottom = '5px';
      historyList.appendChild(li);
    });
  } catch (err) {
    console.error('Не вдалося отримати історію', err);
  }
}
btnExport.addEventListener('click', () => {
  if (!chartInstance) {
    alert("Спочатку побудуйте графік!");
    return;
  }

  const format = exportFormat.value;
  const fileName = chartTitleInput && chartTitleInput.value.trim() ? chartTitleInput.value.trim() : 'Мій_Графік';

  const canvasEl = document.getElementById('myChart') as HTMLCanvasElement;

  if (format === 'png') {
    const imageUrl = chartInstance.toBase64Image('image/png', 1.0);
    const downloadLink = document.createElement('a');
    downloadLink.href = imageUrl;
    downloadLink.download = `${fileName}.png`;
    downloadLink.click();
  } 
  else if (format === 'jpeg' || format === 'pdf') {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasEl.width;
    tempCanvas.height = canvasEl.height;
    const ctx = tempCanvas.getContext('2d');
    
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      ctx.drawImage(canvasEl, 0, 0);
    }

    const jpegUrl = tempCanvas.toDataURL('image/jpeg', 1.0);

    if (format === 'jpeg') {
      const downloadLink = document.createElement('a');
      downloadLink.href = jpegUrl;
      downloadLink.download = `${fileName}.jpeg`;
      downloadLink.click();
    } 
    else if (format === 'pdf') {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      const imgProps = pdf.getImageProperties(jpegUrl);
      const margin = 10;
      const finalWidth = pdfWidth - (margin * 2);
      const finalHeight = (imgProps.height * finalWidth) / imgProps.width;

      pdf.addImage(jpegUrl, 'JPEG', margin, margin, finalWidth, finalHeight);
      pdf.save(`${fileName}.pdf`);
    }
  }
});

async function uploadFileToServer(file: File) {
  const formData = new FormData();
  formData.append('csvFile', file);

  try {
    await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData
    });
    fetchHistory();
  } catch (err) {
    console.error('Помилка завантаження файлу', err);
  }
}

csvInput.addEventListener('change', (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  uploadFileToServer(file);

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      parsedData = results.data;
      headers = results.meta.fields || [];
      populateSelects();
      renderTablePreview();
    },
    error: (error: any) => {
      alert('Помилка читання CSV: ' + error.message);
    }
  });
});

btnCreateNew.addEventListener('click', () => {
  headers = ['Категорія', 'Значення'];
  parsedData = [
    { 'Категорія': 'Пункт 1', 'Значення': '10' },
    { 'Категорія': 'Пункт 2', 'Значення': '25' }
  ];
  
  populateSelects();
  renderTablePreview();

  xAxisSelect.value = 'Категорія';
  const valueCheckbox = document.querySelector('input[value="Значення"]') as HTMLInputElement;
  if (valueCheckbox) {
    valueCheckbox.checked = true;
  }
});

btnAddRow.addEventListener('click', () => {
  const newRow: any = {};
  headers.forEach(header => {
    newRow[header] = '0'; 
  });
  
  parsedData.push(newRow);
  renderTablePreview(); 
});

btnExportCSV.addEventListener('click', async () => {
  if (parsedData.length === 0) {
    alert("Немає даних для експорту!");
    return;
  }

  const csvString = Papa.unparse(parsedData);

  const suggestedName = chartTitleInput && chartTitleInput.value.trim() 
    ? chartTitleInput.value.trim() 
    : 'data_export';

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${suggestedName}.csv`,
        types: [{
          description: 'CSV File',
          accept: { 'text/csv': ['.csv'] },
        }],
      });

      const writable = await handle.createWritable();
      await writable.write(csvString);
      await writable.close();
      
      console.log('Файл успішно збережено!');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Помилка збереження:', err);
      }
    }
  } else {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${suggestedName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});
btnAddColumn.addEventListener('click', () => {
  let counter = headers.length + 1;
  let newColumnName = `Стовпчик ${counter}`;
  while (headers.includes(newColumnName)) {
    counter++;
    newColumnName = `Стовпчик ${counter}`;
  }

  headers.push(newColumnName);
  parsedData.forEach(row => {
    row[newColumnName] = '0'; 
  });

  populateSelects(); 
  renderTablePreview(); 
});
selectAllY.addEventListener('change', (e) => {
  const isChecked = (e.target as HTMLInputElement).checked; 

  const checkboxes = document.querySelectorAll('.y-axis-checkbox') as NodeListOf<HTMLInputElement>;

  checkboxes.forEach(cb => {
    cb.checked = isChecked;
  });

  if (chartInstance) {
    btnRender.click(); 
  }
});
fetchHistory();