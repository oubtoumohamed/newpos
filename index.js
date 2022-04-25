const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWind;

var modalsize = {
  'lg': 992,
  'md': 600,
  'sm': 450,
};

function createWindow (data = {}) {
  var settings = {
    icon: path.join(__dirname, '/assets/icon.png'),
    width: 1200,
    minWidth: 1200, // set a min width!
    show: false,
    // Remove the window frame from windows applications
    frame: false,
    // Hide the titlebar from MacOS applications while keeping the stop lights
    titleBarStyle: 'hidden' || 'customButtonsOnHover',
    webPreferences: {
      preload: '',
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  };

  if( data.hide ){
    settings.show = true;
    settings.frame = true;
  }

  if( data.asmodal || data.without ){
    if( data.asmodal )
      settings.width = settings.minWidth = settings.maxWidth = modalsize[data.modalSize];
    
    settings.frame = true;
  }
  
  const win = new BrowserWindow(settings);
  win.setMenu(null);
  if( !data.asmodal || data.asmodal == false )
    win.maximize();
  
  win.loadFile('views/main.html');

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('window-data', data);
  });

  win.webContents.openDevTools();

  var isDevelopper = false;

  win.webContents.on('before-input-event', (event, input) => {
    if ( input.control && input.shift && input.key.toLowerCase() === 'altgraph') {
      isDevelopper = true;
      event.preventDefault()
    }else{
      if( isDevelopper && input.key.toLowerCase() === 'i'){
        win.webContents.openDevTools();
      }
      isDevelopper = false;
    }

    if( isDevelopper ){
      event.preventDefault();
      return;
    }

    if (input.control && input.key.toLowerCase() === 'r') {
      event.preventDefault()
      win.reload();
    }
  })
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

ipcMain.on('close-app', (evt, arg) => {
  
  app.quit();
  app.exit();

})
.on('newWin', (evt, arg) => {
  createWindow( arg );
});