// 

// console.log(process.versions.electron);

// const {PosPrinter} = require("electron-pos-printer"); //dont work in production (??)
let webContents = remote.getCurrentWebContents();
let printers = webContents.getPrinters(); //list the printers

function defaultprinterof($mdl){
    return defaultprinters[$mdl];
}


function list_printers(){
    var tmp_html_ = '';
    var tmp_html_cdbr = '';
    //var tmp_html_default = '';
    printers.map((item, index) => {
        /*if( item.isDefault )
            tmp_html_default = '<li><a printit="'+item.name+'"><i class="fa fa-print"></i>'+item.name+'</a></li>';
        else*/
        tmp_html_ += '<li><a printit="'+item.name+'"><i class="fa fa-print"></i>&nbsp;&nbsp;'+(item.name.replace(/_/g, ' '))+'</a></li>';
        tmp_html_cdbr += '<li><a printitbarcode="'+item.name+'"><i class="fa fa-print"></i>&nbsp;&nbsp;'+(item.name.replace(/_/g, ' '))+'</a></li>';
        
    });
    
    /*if( tmp_html_default != '' ) 
        tmp_html_default += '<li class="divider"></li>';*/
    
    $('.dropdown_list_printers').html( tmp_html_ );
    $('.dropdown_barcode_list_printers').html( tmp_html_cdbr );
}

async function printbarcodes(content_, callback = null, printerName='', header=0, footer=0) {
    content_ = await content_();
    fullprintbarcodes(content_, callback, printerName, header, footer);
}

async function fullprintbarcodes(content_, callback = null, printerName='', header=0, footer=0) {
    mainprintit(
        'print-barcode',
        content_,
        callback,
        printerName,
        {
            silent: false,
            printBackground: true,
            color: true,
            margins: {
                marginType: 'custom',
                top: 0,left: 0, right: 0, bottom:0,
            },
            landscape: false,
            pagesPerSheet: 1,
            collate: true,
            deviceName: printerName,
            copies: 1,
            //pageSize:'A4',
            header: '',
            footer: ''
        },
        header,
        footer
    )
}

async function printit(content_, callback = null, printerName='', header=0, footer=0, beforeprint=null, $silence) {
    content_ = await content_();
    fullprintit(content_, callback, printerName, header, footer, beforeprint, $silence);
}
async function fullprintit(content_, callback = null, printerName='', header=0, footer=0, beforeprint=null, $silence=false) {

    mainprintit(
        'print',
        content_,
        callback,
        printerName,
        {
            silent: $silence,
            printBackground: false,
            color: true,
            margins: {
                marginType: 'custom',
                top: 0,left: 25, right: 25, bottom:25,
            },
            landscape: true,
            pagesPerSheet: 1,
            collate: false,
            deviceName: printerName,
            copies: 1,
            pageSize:'A4',
            header: '  ',
            footer: '  ',
        },
        header,
        footer,
        beforeprint
    )
}


async function mainprintit(view = 'print', contenuprinted, callback = null, printerName='', options, header=0, footer=0, beforeprint=null) {

    var header_contenu = '';
    var footer_contenu = '';
    var maincontent = '';
    
    if( typeof contenuprinted === "object" ){
        maincontent = contenuprinted.content;
        header_contenu = contenuprinted.header_contenu;
        footer_contenu = contenuprinted.footer_contenu;
    }else{
        maincontent = contenuprinted;
    }

    var printWin = new BrowserWindow({
        width: 700,
        height: 0,
        show: false,
        title: "My App",

        // Hide the titlebar from MacOS applications while keeping the stop lights
        titleBarStyle: 'hidden' || 'customButtonsOnHover',
        webPreferences: {
            preload: '',
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    printWin.webContents.openDevTools();

    maincontent = maincontent.replace(/<!-- pagebreak -->/g, '<div class="pagebreak"></div>');

    //maincontent = '<div class="page-header" style="text-align: center">Im The Header </div> <div class="page-footer">Im The Footer</div>' + maincontent ;
    if( view == 'print' ){
        maincontent = `<div class="page-header">${ header_contenu }</div><div class="page-footer">${ footer_contenu }</div>
        <table class="maintblpage" style="width: 100%;"><thead class="page-header-space"><tr><td>${ header_contenu }</td></tr></thead><tbody><tr><td>${ maincontent }</td></tr></tbody><tfoot class="page-footer-space"><tr><td>${ footer_contenu }</td></tr></tfoot></table>`;
    }

    
    //maincontent = mainheader_contenu + maincontent;

    //printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent( maincontent.replace('</body>', '</body>'))}`);
    //printWin.setTitle('ljklkj k');
    // let win = BrowserWindow.getAllWindows()[0];

    printWin.loadFile('views/'+view+'.html');

    printWin.webContents.on('did-finish-load', function () {
        printWin.webContents.send('window-data', {
            content: maincontent,
            header: header,
            footer: footer,
            header_contenu: header_contenu,
        });
        
        printWin.webContents.print(options, (success, failureReason) => {
            if (!success) console.log(failureReason);

            console.log('Print Done.');
            printWin.close();

            if( callback )
            callback(printerName);
        });
        //printWin.webContents.send('window-data', maincontent);
    });
    


    /*
    log(content_())

    const data = [
        {
            type: "text", // 'text' | 'barCode' | 'qrCode' | 'image' | 'table
            value: "<div style'padding: 500px;'>" + content_() + "</div>"
        }
    ]
    
    if (!printerName){
        printers.forEach(function(item){ 
            if( item.isDefault ){
                printerName = item.name;
                return;
            }
        });
    }
    if (!printerName && printers.length > 0){
        printerName = printers[0].name;
    }
    
    const options = {
        preview: false, // Preview in window or print
        width: '100%', //  width of content body
        copies: 1, // Number of copies to print
        printerName: printerName, // printerName: string, check it at webContent.getPrinters()
        timeOutPerLine: 1000,
        silent: true,
    };

    return PosPrinter.print(data, options)
    .then((a) => {
        console.log(a);
        if( callback )
            callback(printerName);
    })
    .catch((error) => {
       console.log(error);
     });



    *var $printed = await PosPrinter.print(data, options)
        .then(() => {
            console.log("+++++++++++");
            log('-Printed :-----------------------------')
        })
        .catch((error) => {
            //console.error(error);
        });

    log('-------------------------Printed :-----------------------------')
    log( $printed );

    return $printed;*/
}
/*ipcMain.on('window-print', (evt, arg) => {
    
    printWin.webContents.print(options, (success, failureReason) => {
        if (!success) console.log(failureReason);

        console.log('Print Done.');
        //printWin.close();
            
        if( callback )
        callback(printerName);
    });

})*/


/*-----------------------------------------------*/

/*-----------------------------------------------*/


$(document).on('click','[printit]',async function(){    
    $parentcontent = $(this).closest('ul').data('content-print');
    $content = $(this).data('content-print');

    $beforeprint = $(this).data('before-print');
    
    $parentcallback = $(this).closest('ul').data('callback-print');
    $callback = $(this).data('callback-print');

    $header = $(this).data('header');
    $footer = $(this).data('footer');
    $silence = $(this).data('silence') ? false : true;
    
    $_content_ = $content || $parentcontent;
    $_callback_ = $callback || $parentcallback;

    $data = await printit( 
        window[$_content_], 
        window[$_callback_], 
        $(this).attr('printit'),
        $header,
        $footer,
        window[$beforeprint],
        $silence 
    );
});
$(document).on('click','[printitbarcode]',async function(){
    $parentcontent = $(this).closest('ul').data('content-print');
    $content = $(this).data('content-print');
    
    $parentcallback = $(this).closest('ul').data('callback-print');
    $callback = $(this).data('callback-print');

    $_content_ = $content || $parentcontent;
    $_callback_ = $callback || $parentcallback;

    $data = await printbarcodes( 
        window[$_content_], 
        window[$_callback_], 
        $(this).attr('printitbarcode') 
    );
    
    //log($data);
});