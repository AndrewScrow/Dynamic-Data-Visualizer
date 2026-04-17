import Papa from 'papaparse';
import Chart from 'chart.js/auto';
import { jsPDF } from "jspdf";
import type { ChartType } from 'chart.js';

// Отримуємо елементи з HTML
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

// Змінні для збереження даних
let parsedData: any[] = [];
let headers: string[] = [];
let chartInstance: Chart | null = null;

// 1. Слухач події: Завантаження файлу
csvInput.addEventListener('change', (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  Papa.parse(file, {
    header: true, // Перший рядок вважаємо заголовками
    skipEmptyLines: true,
    complete: (results) => {
      parsedData = results.data;
      headers = results.meta.fields || [];
      
      console.log("Дані завантажено:", parsedData);
      
      // Оновлюємо інтерфейс
      populateSelects();
      renderTablePreview();
    },
    error: (error: any) => {
      alert('Помилка читання CSV: ' + error.message);
    }
  });
});

function populateSelects() {
  // 1. ЗБЕРІГАЄМО ПОТОЧНИЙ СТАН ПЕРЕД ОЧИЩЕННЯМ
  const previousX = xAxisSelect.value; // Запам'ятовуємо обрану вісь X
  
  // Запам'ятовуємо, які чекбокси були відмічені
  const previousSelections = new Set(
    Array.from(document.querySelectorAll('.y-axis-checkbox:checked'))
      .map(cb => (cb as HTMLInputElement).value)
  );
  
  // Запам'ятовуємо обрані кольори для кожної колонки
  const previousColors: {[key: string]: string} = {};
  document.querySelectorAll('.y-axis-checkbox').forEach(cb => {
    const val = (cb as HTMLInputElement).value;
    const colorPicker = cb.nextElementSibling as HTMLInputElement;
    previousColors[val] = colorPicker.value;
  });

  // 2. ОЧИЩАЄМО СПИСКИ (як і раніше)
  xAxisSelect.innerHTML = '';
  yAxisCheckboxes.innerHTML = ''; 
  xAxisSelect.disabled = false;

  if (selectAllY) {
    selectAllY.disabled = false;
  }

  const defaultColors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6610f2'];

  // 3. ПЕРЕБУДОВУЄМО ЕЛЕМЕНТИ
  headers.forEach((header, index) => {
    // Створюємо опцію для осі X
    const optionX = document.createElement('option');
    optionX.value = header;
    optionX.textContent = header;
    xAxisSelect.appendChild(optionX);

    // Створюємо контейнер для осі Y
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

    // ВІДНОВЛЮЄМО ГАЛОЧКУ, якщо вона була раніше
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
    
    // ВІДНОВЛЮЄМО КОЛІР, якщо він був обраний раніше, інакше ставимо дефолтний
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

  // 4. ВІДНОВЛЮЄМО ОБРАНУ ВІСЬ X
  if (headers.includes(previousX)) {
    xAxisSelect.value = previousX;
  }
  
  // Оновлюємо стан головного чекбокса "Обрати всі"
  const allCheckboxes = Array.from(document.querySelectorAll('.y-axis-checkbox')) as HTMLInputElement[];
  if (allCheckboxes.length > 0) {
    selectAllY.checked = allCheckboxes.every(cb => cb.checked);
  }
}
function renderTablePreview() {
  tableHead.innerHTML = '';
  tableBody.innerHTML = '';

  // --- 1. ЗАГОЛОВКИ ТАБЛИЦІ ---
  const trHead = document.createElement('tr');

  // НОВЕ: Спочатку додаємо колонку для хрестиків (вона буде першою зліва)
  const thAction = document.createElement('th');
  thAction.style.width = '30px';
  thAction.style.backgroundColor = '#e2e8f0';
  // Робимо її "липкою" до лівого краю
  thAction.style.position = 'sticky';
  thAction.style.left = '0';
  thAction.style.zIndex = '12'; // Щоб вона перекривала інші колонки при скролі
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

  // --- 2. ТІЛО ТАБЛИЦІ ---
  parsedData.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    
    // НОВЕ: Кнопка видалення рядка (тепер створюється найпершою)
    const tdAction = document.createElement('td');
    tdAction.style.textAlign = 'center';
    tdAction.style.backgroundColor = '#ffffff'; // Білий фон, щоб інші колонки не просвічувались під нею
    tdAction.style.position = 'sticky';
    tdAction.style.left = '0';
    tdAction.style.zIndex = '2'; // Щоб залишалась поверх інших даних
    
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
    tr.appendChild(tdAction); // Додаємо колонку з хрестиком найпершою!
    
    // Клітинки з даними
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

// --- 4. Слухач події: Натискання кнопки "Побудувати" ---
btnRender.addEventListener('click', () => {
  if (parsedData.length === 0) {
    alert("Спочатку завантажте файл!");
    return;
  }

  // 1. Отримуємо тип графіка, який вибрав користувач
  const type = chartTypeSelect.value; 
  
  // 2. Адаптуємо типи для Chart.js (бо він не знає про 'area' і 'stackedBar')
  let chartJsType = type;
  if (type === 'area') chartJsType = 'line';
  if (type === 'stackedBar') chartJsType = 'bar';

  const isStacked = type === 'stackedBar';

  const xKey = xAxisSelect.value;
  const customTitle = chartTitleInput ? chartTitleInput.value.trim() : '';

  // 3. Збираємо всі чекбокси, які позначені галочками
  const checkedBoxes = Array.from(document.querySelectorAll('.y-axis-checkbox:checked')) as HTMLInputElement[];

  // if (checkedBoxes.length === 0) {
  //   alert("Оберіть хоча б одну колонку для осі Y (поставте галочку)!");
  //   return;
  // }

  const labels = parsedData.map(row => row[xKey]);
  
  // 4. Формуємо набори даних (datasets)
  const datasets = checkedBoxes.map((checkbox) => {
    const yKey = checkbox.value;
    const colorPicker = checkbox.nextElementSibling as HTMLInputElement;
    const color = colorPicker.value;

    let bgColors: string | string[] = color + '55'; // Стандартна напівпрозора заливка
    let borderColors: string | string[] = color; 

    // Специфіка для кругових діаграм
    if (type === 'pie' || type === 'doughnut' || type === 'polarArea') {
      const pieColors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#EA6B66', '#73C0DE', '#3BA272', '#FC8452'];
      bgColors = labels.map((_, index) => pieColors[index % pieColors.length] + 'CC');
      borderColors = labels.map((_, index) => pieColors[index % pieColors.length]);
    }

    // Специфіка для радара
    if (type === 'radar') {
      bgColors = color + '22';
    }

    // Форматування даних (координати для scatter/bubble, звичайні для інших)
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

  // Викликаємо функцію малювання з правильними аргументами
  renderChart(labels, datasets, chartJsType, customTitle, isStacked);
});


// --- 5. Функція: Малювання графіка ---
// (Тут також виправлено помилку "type: type" з твого першого скріншоту)
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
    // ПЛАГІН ВИДАЛЕНО, графік знову має прозорий фон!
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

// --- Нові змінні ---
const historyList = document.getElementById('historyList') as HTMLUListElement;
const selectAllY = document.getElementById('selectAllY') as HTMLInputElement;
// --- Функція: Завантаження історії з сервера ---
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
// --- Слухач події: Експорт графіка у PNG ---
// --- Слухач події: Експорт графіка у різні формати ---
// --- Слухач події: Експорт графіка у різні формати ---
btnExport.addEventListener('click', () => {
  if (!chartInstance) {
    alert("Спочатку побудуйте графік!");
    return;
  }

  const format = exportFormat.value;
  const fileName = chartTitleInput && chartTitleInput.value.trim() ? chartTitleInput.value.trim() : 'Мій_Графік';
  
  // Отримуємо наш оригінальний HTML елемент canvas
  const canvasEl = document.getElementById('myChart') as HTMLCanvasElement;

  if (format === 'png') {
    // 1. Експорт PNG (нативно, з прозорим фоном)
    const imageUrl = chartInstance.toBase64Image('image/png', 1.0);
    const downloadLink = document.createElement('a');
    downloadLink.href = imageUrl;
    downloadLink.download = `${fileName}.png`;
    downloadLink.click();
  } 
  else if (format === 'jpeg' || format === 'pdf') {
    // 2. Експорт JPEG/PDF (підкладаємо білий фон через віртуальне полотно)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasEl.width;
    tempCanvas.height = canvasEl.height;
    const ctx = tempCanvas.getContext('2d');
    
    if (ctx) {
      // Заливаємо віртуальне полотно білим кольором
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      // Малюємо наш прозорий графік поверх білого фону
      ctx.drawImage(canvasEl, 0, 0);
    }

    // Отримуємо JPEG картинку з віртуального полотна
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

// --- Функція: Відправка файлу на сервер ---
async function uploadFileToServer(file: File) {
  const formData = new FormData();
  formData.append('csvFile', file);

  try {
    await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData
    });
    // Після успішного завантаження оновлюємо список
    fetchHistory();
  } catch (err) {
    console.error('Помилка завантаження файлу', err);
  }
}

// --- Модифікація існуючого слухача подій (csvInput) ---
// Знайди свій старий код csvInput.addEventListener і додайте туди виклик uploadFileToServer
csvInput.addEventListener('change', (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  // 1. Відправляємо на сервер
  uploadFileToServer(file);

  // 2. Парсимо для відображення (старий код залишається)
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
// --- Створення нової таблиці з нуля ---
btnCreateNew.addEventListener('click', () => {
  headers = ['Категорія', 'Значення'];
  parsedData = [
    { 'Категорія': 'Пункт 1', 'Значення': '10' },
    { 'Категорія': 'Пункт 2', 'Значення': '25' }
  ];
  
  populateSelects();
  renderTablePreview();
  
  // Автоматично обираємо осі для зручності
  xAxisSelect.value = 'Категорія';
  const valueCheckbox = document.querySelector('input[value="Значення"]') as HTMLInputElement;
  if (valueCheckbox) {
    valueCheckbox.checked = true;
  }
});

// --- Додавання порожнього рядка ---
btnAddRow.addEventListener('click', () => {
  const newRow: any = {};
  // Створюємо порожній об'єкт з наявними заголовками
  headers.forEach(header => {
    newRow[header] = '0'; // Значення за замовчуванням
  });
  
  parsedData.push(newRow);
  renderTablePreview(); // Перемальовуємо таблицю
});

// --- Експорт змінених даних у CSV ---
// --- Покращений експорт у CSV через File System Access API ---
btnExportCSV.addEventListener('click', async () => {
  if (parsedData.length === 0) {
    alert("Немає даних для експорту!");
    return;
  }

  // 1. Формуємо вміст CSV за допомогою PapaParse
  const csvString = Papa.unparse(parsedData);

  // 2. Отримуємо назву з поля "Заголовок графіка" або ставимо стандартну
  const suggestedName = chartTitleInput && chartTitleInput.value.trim() 
    ? chartTitleInput.value.trim() 
    : 'data_export';

  // Перевіряємо, чи підтримує браузер новий API (Chrome, Edge, Opera)
  if ('showSaveFilePicker' in window) {
    try {
      // Відкриваємо системне вікно збереження
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${suggestedName}.csv`,
        types: [{
          description: 'CSV File',
          accept: { 'text/csv': ['.csv'] },
        }],
      });

      // Створюємо потік для запису та зберігаємо файл
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
    // FALLBACK: Якщо браузер старий (напр. Firefox), використовуємо стандартне завантаження
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
// --- Додавання нового стовпчика (без спливаючих вікон) ---
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

  // Тепер ці функції працюють "тихо" і зберігають твій вибір
  populateSelects(); 
  renderTablePreview(); 
});
// --- Слухач події для "Обрати всі" ---
selectAllY.addEventListener('change', (e) => {
  // Дізнаємося, поставили ми галочку чи зняли
  const isChecked = (e.target as HTMLInputElement).checked; 
  
  // Знаходимо всі наші звичайні чекбокси
  const checkboxes = document.querySelectorAll('.y-axis-checkbox') as NodeListOf<HTMLInputElement>;
  
  // Ставимо їм такий самий стан
  checkboxes.forEach(cb => {
    cb.checked = isChecked;
  });

  // Якщо графік вже створено, перемальовуємо його
  if (chartInstance) {
    btnRender.click(); 
  }
});
// Завантажуємо історію при запуску сторінки
fetchHistory();