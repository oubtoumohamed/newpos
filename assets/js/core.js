const electron = require('electron');
const {app, remote, ipcRenderer } = electron;
const { BrowserWindow, ipcMain } = electron.remote;

const Barcode = require('barcode-scanner-web');
let scanner = new Barcode.Scanner();

var win = remote.getCurrentWindow();

const configoptions = {
    multiprice: false,
    maxdiscount: 20,
    updatename: false,
    showpurchase_price: true,
    updatePrice: true,
};

var fs = require('fs');
var path = require('path');
//const lisConn = require('../communication/connection.js').connection;
var userDataPath = (electron.app || electron.remote.app).getPath('userData');
var configPath = path.join(userDataPath, 'configuration.json');
var configPrintersPath = path.join(userDataPath, 'printers.json');
var defaultprinters = {};
const config = {};

try {
    var customconfig = JSON.parse(fs.readFileSync(configPath));
    $.extend(config, customconfig);
} catch(error) { }

try {
    defaultprinters = JSON.parse(fs.readFileSync(configPrintersPath));
} catch(error) { }

var homedata = {
    module: 'dashboard',
    asmodal: false,
    aswindow: false,
};

ipcRenderer.on('window-data', async function (event,data) {
    if(data.module)
        homedata = data;
});

i = 0;

let $lang = 'en';
let $current_module = '';
let $current_action = '';
var $selectizes = [];
var lastList = [];
var params = {};
var afterviewload = {
    apply : function() {
        //
    }
};

/**
 * Store  navigation views
 * @part : last part of url
 **/

var navigationPages = [];
var nav_page = 1;
async function navigate(){
    navigationPages.pop();
    var cnfg__ = navigationPages[ navigationPages.length - 1 ]; //.pop(); //( navigationPages[nav_page] || null );
    if( cnfg__ ){
        cnfg__.trace = false;
        cnfg__.fromnavigate = true;
        await loadView(cnfg__);
    }
}

async function navigateTitle(module, action="page"){
    action = action || "page";
    $('.navigation_current_page').html( __( `${module}.${action}`));

    if( navigationPages.length )
        $('.navigation_preview_page').show();
    else
        $('.navigation_preview_page').hide();
}

async function navigateRefresh(){
    var cnfg__ = navigationPages[ navigationPages.length - 1 ]; //.pop(); //( navigationPages[nav_page] || null );
    if( cnfg__ ){
        cnfg__.trace = false;
        cnfg__.fromnavigate = true;
        await loadView(cnfg__);
    }
}

function navigatePreview(){
    //if( nav_page == 0 || nav_page == navigationPages.length )
        //return ;
    //if( nav_page >= 0 ){
      //  nav_page -= 1;
    navigate();
    //}
}

function navigateNext(){
    //if( nav_page == 0 || nav_page == navigationPages.length )
        //return ;
    if( nav_page < navigationPages.length -1 ){
        nav_page += 1;
        navigate();
    }
}

function traceNavigation(cnfg){
    navigationPages.push(cnfg);
    nav_page = navigationPages.length - 1;
}

/**
 * build API full link
 * @part : last part of url
 **/

function checkRequiredField(parentClass, module=""){

    $rtrn = false;
    $(`${parentClass} select.validate:not(.selectized)`).each(function(){
        if( !$(this).val() ){
            $(this).focus();
            $rtrn = true;
            return false;
        }
    });

    $('.selectize-control').removeClass('focused');

    $(`${parentClass} select.selectized.validate`).each(function(){
        if( $(this).data('selectize') && !$(this).data('selectize').getValue() ){
            $(this).data('selectize').focus();
            $(this).next().addClass('focused');
            $rtrn = true;
            return false;
        }
    });

    if( $rtrn == true )
        return $rtrn;

    if( $(`${parentClass} .validate:invalid`).length ){
        $(`${parentClass} .validate:invalid`).first().focus();
        return true;
    }
    

    return $rtrn;
}

/**
 * build API full link
 * @part : last part of url
 **/
function apiLink( part ){
    return config.APP_URL + "api/" + part;
}
function mediaLink( part ){
    return config.APP_URL + "storage/" + part;
}
function media_preview($media, $type){
    var $src  = "../assets/img/img_file.png";

    switch ($type) {
        case "image/jpg":
        case "image/png":
        case "image/gif":
        case "image/jpeg":
            $src = mediaLink($media);
            break;
    }
    return $src;
}

/**
 *  Send ajax request
 *  
 *  @prms : { module: 'demande|..', action: 'list|create|...', filter: '', type: 'get|post', data: {}, silence: bool, success_: function, error_: function }
 *  
**/


async function doAjax( prms ) { 
    
    // default configuration
    var cnfg = {
        url: "",
        module: "",
        action: "",
        filter: "",
        page: "",
        type: "get",
        headers: {
            "Authorization" : "Bearer " + accessToken() ,
            "X-Requested-With" : "XMLHttpRequest"
        },
        dataType: 'json',
        data: {},
        silence: false,
        loadnig: false,
        firenotgranted: true,
        success: function(res){

            if( res && res.data && (this.action == 'create' || this.action == 'update') ){
                //params.id = res.data.id;
                $('button[filter="false"]').trigger('click');
                closeModal();
            }

            if( this.success_ ){
                this.success_(res);
            }

            if( this.silence )
                return;

            var msg = "", state = "";

            if( res && res.success ){
                msg = res.success;
                state = 'success';
            }

            if( res && res.warning ){
                msg = res.warning;
                state = 'warning';
            }

            if( res && res.error ){
                msg = res.error;
                state = 'error';
            }

            if( msg && state )
                showMessage({
                    title: msg,
                    /*text: "S'il vous plaît essayer encore",*/
                    icon: state,
                    timer: 2000,
                    timerProgressBar: true
                })
        },
        error: function(err){
            if( this.error_ ){
                this.error_(err);
            }else{
                bsalert(err, 'danger');
            }
        }
    };
    // merge prms with default config
    delete prms.success;
    delete prms.error;

    $.extend(cnfg, prms);

    if( ! cnfg.module || ! cnfg.action ){
        //alert('module !!! / action !!!');
        alert('module && action required.');
        return;
    }

    if( cnfg.silence == false || cnfg.loadnig )
        loading();

    // build full api link
    cnfg.url = apiLink(`${cnfg.module}/${cnfg.action}?${cnfg.filter}${( cnfg.page ? `&page=${cnfg.page}` : `` )}`);

    // send ajax
    var resu;
    //resu = await $.ajax(cnfg).catch(e => {});


    if( cnfg.silence == false || cnfg.loadnig )
        loading(false);

    return resu;
}


/**
 *  Replace any '{{ config.field }}' with their config
 *  
 *  @content : text
 *  
**/
async function configurate(content){

    // replace fields with their cofig
    var re = /({{ config.[A-Z]*[_]?[A-Z]* }})/g;
    if( content ){   
        content = content.replace(re, function(val_){

            val_ = val_.replace('{{ ', '').replace(' }}','');
            // show fields needs to configurate
            if( ! eval(val_) )
                log( val_ );

            return ( eval(val_) || val_ );
        });
    }

    return content;
}


/**
 *  Replace any 'trans_module.field' with their translate
 *  
 *  @content : text
 *  
**/

async function loadTransFiles(){
    
    var files = [
        'global',
        'groupe',
        'achat',
        'user',
        'supplier',
        'client',
        'charge',
        'shelf',
        'categorie',
        'product',
    ];

    $i = 0;
    while( $i < files.length ){
        await $.getScript('../trans/'+langage()+'/'+ files[$i] + '.js');
        $i++;
    }
}

function __( text, prms = [] ){
    /*var mdl = text.split('.')[0];
    if( eval(`typeof trans_${mdl}`) === 'undefined' ){
        await loadTransFile(mdl);
        
        if(typeof eval(`trans_${text}`) === 'undefined' )
            return text;
    }*/
    try{ 
        text = eval(`trans_${text}`);
        prms.forEach(function(e){ 
            text = text.replace( /(:[a-z]+)/ , e);
        })
    }catch(e){}

    /*if( eval(`typeof trans_${text}`) === 'undefined' ){
        //
    }else{
        text = eval(`trans_${text}`);
    }*/


    return text || '';
}

async function translate(content){
    // fetch for modules 
    modules_ = content.match(/(trans_[a-z]*)/g);

    if( modules_ ){
        // delete repeated modules
        //modules_ = modules_.filter(onlyUnique);
        // replace fields with their translate
        var re = /(trans_[a-z]+[_]*[a-z]*.)[a-z]+[_]*[a-z]*/g;
        content = content.replace(re, function(val_){
            //console.log(val_)
            // show fields needs to trans it
            var mot = '';
            try{
                mot = eval(val_);
            }catch(e){

            }


            return ( mot || val_ );
        });
    }

    return content;
}


/**
 *  load a custom view partition
 *  
 *  @prms : { view: '#mainpage|...', module: 'demande|..', action: 'list|update|...', params: {}, asmodal: boolean, modalView: '#modalView', modalSize: "lg", callback: function }
 *  
**/
async function loadView( prms ){

    if( ! prms.module )
        return;
    
    if( prms.aswindow ){
        ipcRenderer.send('newWin', prms);
        return false;
    }

    // make loading interface
    loading();
    //$('li').css('pointerEvents','auto')
    //$('a').css('pointerEvents','auto')
    // default configuration
    var cnfg = {
        view: '#mainpage',
        module: "",
        action: "",
        params: null,
        aswindow: false,
        hide: false,
        asmodal: false,
        subview: false,
        modalView: '#modalView',
        modalSize: "lg",
        trace: true,
        fromnavigate: false,
        without: "",
        callback: null, //function(c){ },
        beforeShow: null, //function(c){ },
        afterShow: null, //function(c){ },
    };

    // merge prms with default config
    $.extend(cnfg, prms);
    $.extend(cnfg, cnfg.params);

    cnfg.path = cnfg.module+( cnfg.action ? '/'+cnfg.action : '' )+'.html';

    // check if has a valide access token
    if( cnfg.module != "login" && !checkToken() ){
        return false;
    }

    // check is granted in this module/action
    /*if( cnfg.module && cnfg.action){
        if( !isGranted(cnfg.module) ){
            unauthorized(trans_global.nopermission, trans_global.nopermissiontext, 'error');
            return false;
        }   
    }*/

    // store current module && action    
    $current_module = cnfg.module;
    $current_action = cnfg.action;
    
    // get file content
    var content = await $.get(cnfg.path).fail(function() {
        loading(0);
        return false;
    });

    // load translation
    content = await translate(content);
    
    // load configuration
    content = await configurate( content );
    
    // share params with this new view
    //$.extend(params, cnfg.params);
    //if( cnfg.params ){
        if( cnfg.subview ){
            $.extend(params, cnfg.params);
        }else{
            params = cnfg.params;
        }
    //}

    // call hook beforeshow content
    if( cnfg.beforeShow ) cnfg.beforeShow(content);

    /*LOAD ANALYSE JS */
        //await $.getScript('../assets/js/analyse.js');
    /*LOAD ANALYSE JS */

    if( cnfg.callback ){
        // use callback function if exists
        cnfg.callback(content);
    }else{
        var finalview = "";
        // show final result
        loading(false);
        if( cnfg.asmodal ){
            $( cnfg.modalView + " .modal-body").html( content );
            var viewtitle = cnfg.module+'.'+( cnfg.action == 'update' ? params && params.id ? 'update' : 'new' : cnfg.action );
            $( cnfg.modalView + ' .modal-header .modal-title').text( __(viewtitle) );
            $( "#modalSizeView" ).attr('class', 'modal-dialog modal-'+ cnfg.modalSize );
            $( cnfg.modalView ).modal('show');
            finalview = cnfg.modalView;
        }else{
            
            if( cnfg.trace || cnfg.fromnavigate ){
             navigateTitle( cnfg.module, cnfg.action );
            }

            if( cnfg.trace && cnfg.view == '#mainpage' ){
                traceNavigation(cnfg);
            }

            $( cnfg.view ).html( content +'<div class="clearfix"></div>' );
            finalview = cnfg.view;
        }

        // apply date picker to input if exists in this view
        applyDateTimePicker( finalview );

        // call hook beforeshow content
        if( cnfg.afterShow ) cnfg.afterShow(content);
        
        afterviewload.apply();

    }
    list_printers();
    // chek is granted for all link in this view
    checkPermission( finalview );
}


/**
 *  Clear old session data and load login view
**/
async function logout(){

    /*
    if( accessToken() )
        await doAjax({
            module: "user",
            action: "logout",
            type: "get",
            success_: function(res){
            },
            error_: function(xhr){
            }
        });
    */

    var $auth = auth();

    if( $auth && $auth.session && $auth.session.id ){
        await new Session().save({
            id: $auth.session.id,
            close_at: getdate('Y-m-d H:i:s')
        })
        .then( async function(session) {
        })
        .catch(function (err){
        });        
    }

   
    clearStorage();
    loadView({ module: 'login', view:'body' });
    //window.location.reload();
}

/**
 *  Authentificate user
**/
async function login(){

    await new User().login({
        username: $("input#username").val(),
        password: $("input#password").val()
    })
    .then( async function(user) {

        if( accessToken( user && user.id ) ){
            auth( user );
            roles( user.role );
            if( user.caisse == 1 ){
                return showMessage({
                    title: 'Le montant dans la caisse',
                    html: `<input type="number" id="caisse_count" class="swal2-input" step="0.01">`,
                    focusConfirm: false,
                    allowEscapeKey : false,
                    allowOutsideClick: false,
                    preConfirm: () => {
                        const caisse_count = Swal.getPopup().querySelector('#caisse_count').value
                        return { caisse_count: caisse_count}
                    }
                }).then(async (result) => {
                    if (result.isConfirmed) {

                        await new Session().create({
                            user_id: auth().id,
                            caisse: result.value.caisse_count,
                            open_at: getdate('Y-m-d H:i:s')
                        })
                        .then( async function(session) {
                            if( session && session.id ){
                                var oldauth = auth();
                                oldauth.session = session;
                                auth( oldauth );
                                window.location.reload();
                            }
                        })
                        .catch(function (err){
                            showMessage({
                                title: 'Erreur!',
                                text: "S'il vous plaît essayer encore",
                                icon: 'error'
                            });
                        });
                    }
                });
            }else{
                window.location.reload();
            }
        }else{
            showMessage({
                title: "Authentification échouée",
                icon: 'warning'
            });
        }
    })
    .catch(function (err){
        showMessage({
            title: 'Erreur!',
            text: "S'il vous plaît essayer encore",
            icon: 'error'
        });
    });

}


/**
 *  Check if has a valide session and not expired 
**/
function checkToken(){
    if( auth() )
        return true;

    // end session if has no valide token
    logout();
    bsalert(trans_global.unauthenticated + " " +trans_global.unauthenticatedtext, 'danger');
    return false;
}

/**
 *  Check is granted for all links in a view
 *  @view : view selector
**/
function checkPermission(view = ""){
    //view = view ? view+" " : "";
    $(`[loadView]`).each(function(){

        $role_ = $(this).data('permission');

        if( $role_ && !isGranted( $role_ ) ){
            $(this).remove();
        }
    });
}

/**
 *  Check user if has this role
 *  @$role : 'demande|rendezvous|...'
**/
function isGranted($role){
    $return = false;
    $role = $role.toUpperCase();

    $.each( roles(), function(k , v){
        if( $role == v.toUpperCase() || v == "ADMIN" ){
            $return = true;
        }
    });

    return $return;
}


/**
 *  Show alert when un athorizd action
 *  @$role : 'demande|rendezvous|...'
**/
function unauthorized(title, text, icon){
    $("#modalView .modal-body").html("");
    $("#modalView").modal('hide');
    logout();
    showMessage({
        title: title,
        text: text,
        icon: 'error',
        showCancelButton: false,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#555',
        confirmButtonText: trans_global.relogin,
        cancelButtonText: trans_global.annuler
    }).then((result) => {
        if (result.isConfirmed) {
        }
    })
}


 /**************************************************************************
  *
  *                       
  *                  @Support-functions
  * 
  * 
  *************************************************************************/

/**
 * Delete duplicated keys in array ( used with filter function )
 **/
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

/**
 * Show and Hide the splach screen
 * @show : boolean 
 **/
function loading(show=true){
    show ? $('#loading').removeClass('active') : $('#loading').addClass('active')
}


/**
 * get date now with specific format
 * @format : "d-m-Y H:i"
 **/

var moths = [
    'Janvier',
    'Février',
    'Mars',
    'Avril'	,
    'Mai',
    'Juin'	,
    'Juillet',
    'Août',
    'Septembre'	,
    'Octobre'	,
    'Novembre',
    'Décembre'
];
// les jours :
var days = [
    'Dim',
    'Lun',
    'Mar', 
    'Mer',
    'Jeu',
    'Ven',
    'Sam', 
];

function getdate(format = "d-m-Y", add = {
    y: 0,
    m: 0,
    d: 0 
}){

    var dt = new Date();    
    var y = dt.getFullYear() + ( add.y || 0 );
    var m = dt.getMonth() + 1 + ( add.m || 0 );
    var d = dt.getDate() + ( add.d || 0 );
    var h = dt.getHours();
    var i = dt.getMinutes();

    d = d < 10 ? "0"+d : d;
    m = m < 10 ? "0"+m : m;
    h = h < 10 ? "0"+h : h;
    i = i < 10 ? "0"+i : i;

    return format.replace('Y', y)
                 .replace('m', m)
                 .replace('d', d)
                 .replace('H', h)
                 .replace('i', i)
                 .replace('s', '00');
}


/**
 * show user information and clock in navbar
 **/
function profileInfo() {
    $(".info_user_name").text( store_("info_user_name") );
    $(".info_site").text( store_("info_user_site") ); 
    updateClock();
}

function dateFomat(dt, frmt = 'DD-MM-Y'){
    return moment(dt).format(frmt);
}

function dateTimeFomat(dt){
    return moment(dt).format('DD-MM-Y H:mm:ss');
}

function timeFomat(dt){
    return moment(dt).format('H:mm:ss');
}

/**
 * update clock in navbar
 **/
function updateClock(){
    function checkTime(i) {
        if (i < 10) {
            i = "0" + i
        }  // add zero in front of numbers < 10
        return i;
    }

    var d = new Date();
    var year = d.getFullYear();
    var date = d.getDate();
    var monthName = trans_global.mois[d.getMonth()];
    var dayName = trans_global.jours[d.getDay()]; 
    var time = checkTime( d.getHours() ) + ":" + checkTime( d.getMinutes() );
    
    $('.info_date_').text( `${dayName}, ${date} ${monthName} ${year} - ${time}` );

    // TODO : update time correclty 
    var t = setTimeout(updateClock, 60 * 1000);
}

/**
 * 
 **/
function log(val){
    return console.log( val );
}


/**
 * load date/time picker 
 * @view : string 
 **/
function applyDateTimePicker(view = ""){

    view = view ? view+" " : "";

    prmsDefaultDateTime = {
        format:'d-m-Y H:i',
        step:5,
        language: 'fr',
    };

    prmsDefaultDate = {
        timepicker:false,
        format:'d-m-Y',
        language: 'fr',
    };

    prmsDefaultTime = {
        datepicker:false,
        format:'H:i',
        step:5,
        language: 'fr',
    };

    $.datetimepicker.setLocale('fr');
    
    $(`${view}.datetime.default-empty`).datetimepicker( prmsDefaultDateTime );

    prmsDefaultDateTime.value = getdate('d-m-Y H:i');
    $(`${view}.datetime:not(.default-empty)`).datetimepicker( prmsDefaultDateTime );
    
    $(`${view}.date.default-empty`).datetimepicker( prmsDefaultDate );
    
    prmsDefaultDate.value = getdate('d-m-Y');
    $(`${view}.date:not(.default-empty)`).datetimepicker( prmsDefaultDate );
    
    $(`${view}.time.default-empty`).datetimepicker( prmsDefaultTime );

    prmsDefaultTime.value = getdate('H:i');
    $(`${view}.time:not(.default-empty)`).datetimepicker( prmsDefaultTime );
}

function applyDate(selector_){
    $(selector_).datetimepicker({
        timepicker:false,
        format:'d-m-Y',
        mask: true,
        value: getdate('d-m-Y'),
        language: 'fr',
    });
}

function applyDateTime(selector_){
    $(selector_).datetimepicker({
        format:'d-m-Y H:i',
        mask: true,
        step:5,
        value: getdate('d-m-Y H:i'),
        language: 'fr',
    });
}

function applyTime(selector_){
    $(selector_).datetimepicker({
        datepicker:false,
        format:'H:i',
        mask: true,
        step:5,
        value: getdate('H:i'),
        language: 'fr',
    });
}

 /**************************************************************************
  *
  *                       
  *                  @Alerts-and-messages
  * 
  * 
  *************************************************************************/


/**
 * Pop-Up message
 * @options : SweetAlert options 
 **/
function showMessage(options){
    return Swal.fire( options )
    return alert( options.title +" \n"+ options.text )
}


/**
 * Simple notification message
 * @msg : message
 * @status : success|danger|warning
 **/
function bsalert(msg, status='success'){
    if( !$('.bsalert').length )
        return;

    let icon_status = 'check-circle';
    if(status == 'warning') icon_status = 'exclamation-triangle';
    else if(status == 'danger') icon_status = 'times-circle';

    //$('.bsalert').html('');
    let dv_alert = '<div class="alert alert-'+status+' alert-dismissible">' +
                        '<i class="fa fa-times btn_icon_femer close_" data-dismiss="alert" aria-label="close" alt="fermer" aria-hidden="true"></i>' +
                        '<div><i class="btn_icon_alert fa fa-'+icon_status+'" aria-hidden="true"></i><span>'+msg+'</span></div>' +
                    '</div>';

    $('.bsalert').prepend( dv_alert );
    //$('html, body').animate({ scrollTop: ($('.bsalert').offset().top-10) },500);

    $('.bsalert .alert:first-child').delay(6000).fadeOut();

}


 /**************************************************************************
  *
  *                       
  *                  @Storage-Data
  * 
  * 
  *************************************************************************/


/**
 * change or get application language
 * @val : set langage
 **/
function langage(val){
    if( ! localStorage.langage )
        val = 'fr';

    return store_("langage", val);    
}


/**
 * store values using localStorage
 * @key : name of value 
 * @val : value
 **/
function store_(key, val="valnull"){
    if( val != "valnull" )
        localStorage.setItem(key, val);
    
    return localStorage.getItem(key);
}


/**
 * get or update accessToken
 * @val : new token
 **/
function accessToken(val){
    return store_("accessToken", val);
}


/**
 * get or update user roles
 * @val : roles
 **/
function roles(val){
    $rls = store_("roles",val);
    return $rls ? $rls.split(',') : [];
}

/**
 * get or update expiration date of accessToken
 * @val : new date
 **/
function expires_at(val){
    $dt = store_("expires_at",val);
    return $dt ? new Date( $dt ) : null;
}

/**
 * get or update user informations like name ...
 * @val : user infos
 **/
function auth(val){
    if( val != "" )
        val = JSON.stringify(val);

    return JSON.parse( store_("auth", val) );
}

function isAdmin(){
    return auth().role == "ADMIN";
}

/**
 * clear session
 * @val : new token
 **/
function clearStorage(){
    return localStorage.clear();
}


 /**************************************************************************
  *
  *                       
  *                  @Liste_Functions
  * 
  * 
  *************************************************************************/


function listActions(module_, id_=null, modal="modal", modalsize="md", fieldname="id", destroyCallback=""){
    $module_s = module_.split('@');
    module_ = $module_s[0];
    $action_ = $module_s.length > 1 ? $module_s[1] : 'update';
    
    $actions_ = "";

    if( isGranted(module_.toUpperCase() + '_UPDATE') )
        $actions_ += `<button data-as${modal}="true" data-modalsize="${modalsize}" loadView="${module_},${$action_},{'${fieldname}':${id_}}" type="button" class="btn btn-primary btn-xs"> <i class="fa fa-edit"></i> </button>`;
    
    if( isGranted(module_.toUpperCase() + '_DELETE') )
        $actions_ += `<button destroy="${module_},${id_},${destroyCallback}" type="button" class="btn btn-danger btn-xs"> <i class="fa fa-trash"></i> </button>`;

    return $actions_;
}

function listUpdateAction(module_, id_=null, modal="modal", modalsize="md", fieldname="id"){
    $actions_ = '';
    if( isGranted(module_.toUpperCase() + '_UPDATE') )
        $actions_ = `<button data-as${modal}="true" data-modalsize="${modalsize}" loadView="${module_},update,{'${fieldname}':${id_}}" type="button" class="btn btn-success btn-xs"> <img src="../assets/icons/svg2/pencil.svg" class="btn_icon_xs" alt="icon action" /> </button>`;
    return $actions_;
}

function listShowAction(module_, id_=null, modal="modal", modalsize="md", fieldname="id"){
    $actions_ = '';
    if( isGranted(module_.toUpperCase() + '_SHOW') )
        $actions_ = `<button data-as${modal}="true" data-modalsize="${modalsize}" loadView="${module_},show,{'${fieldname}':${id_}}" type="button" class="btn btn-success btn-xs"> <img src="../assets/icons/svg2/eye__.svg" class="btn_icon_xs" alt="icon action" /> </button>`;
    return $actions_;
}

function listDestroyAction(module_, id_=null, modal="modal", fieldname="id", destroyCallback=""){
    $actions_ = '';
    if( isGranted(module_.toUpperCase() + '_DELETE') )
        $actions_ = `<button destroy="${module_},${id_},${destroyCallback}" type="button" class="btn btn-danger btn-xs"> <i class="fa fa-trash"></i> </button>`;

    return $actions_;
}


/**
 *  Send ajax request
 *  
 *  @prms : { view: "", module: '', action: '', filter: '', type: '', data: {}, success_: function }
 *  
**/

async function find(prms){

    var cnfg = {
        module: null,
        id: null, 
        success_: null,
        error_: null,
    };

    // merge prms with default config
    $.extend(cnfg, prms);

    if( ! cnfg.module || ! cnfg.id )
        return;

    await cnfg.module.find(cnfg.id)
    .then(function(object) {

        if( cnfg.success_ )
            cnfg.success_(object);

    })
    .catch(function (err){
        showMessage({
            title: 'Erreur!',
            text: err.message,
            icon: 'error'
        });

        if( cnfg.error_ )
            cnfg.error_(err);
    });
}

/**
 *  Send ajax request
 *  
 *  @prms : { view: "", module: '', action: '', filter: '', type: '', data: {}, success_: function }
 *  
**/

async function create(prms){

    var cnfg = {
        module: null,
        data: {}, 
        success_: null,
        error_: null,
        closemodal: true,
    };

    // merge prms with default config
    $.extend(cnfg, prms);

    if( ! cnfg.module ) 
        return;

    await cnfg.module.create(cnfg.data)
    .then(function(result) {

        if( cnfg.closemodal ){
            $('button[filter="false"]').trigger('click');
            closeModal();
        }        

        if( cnfg.success_ )
            cnfg.success_(result);

    })
    .catch(function (err){
        showMessage({
            title: 'Erreur!',
            text: err.message,
            icon: 'error'
        });

        if( cnfg.error_ )
            cnfg.error_(err);
    });
}

/**
 *  Send ajax request
 *  
 *  @prms : { view: "", module: '', action: '', filter: '', type: '', data: {}, success_: function }
 *  
**/

async function save(prms){

    var cnfg = {
        module: null,
        data: {}, 
        success_: null,
        error_: null,
    };

    // merge prms with default config
    $.extend(cnfg, prms);

    if( ! cnfg.module ) 
        return;

    await cnfg.module.save(cnfg.data)
    .then(function(result) {
        
        $('button[filter="false"]').trigger('click');
        closeModal();

        if( cnfg.success_ )
            cnfg.success_(result);

    })
    .catch(function (err){
        showMessage({
            title: 'Erreur!',
            text: err.message,
            icon: 'error'
        });

        if( cnfg.error_ )
            cnfg.error_(err);
    });
}

/**
 *  Send ajax request
 *  
 *  @prms : { view: "", module: '', action: '', filter: '', type: '', data: {}, success_: function }
 *  
**/

async function query(prms){
    var cnfg = {
        module: null,
        success_: null,
    };
    // merge prms with default config
    $.extend(cnfg, prms);

    if( ! cnfg.module ) 
        return;

    // load data from server
    var result = {};

    await cnfg.module.query()
    .then(function(result) {
        cnfg.success_(result);
    })
    .catch(function (err){
        showMessage({
            title: 'Erreur!',
            text: err.message,
            icon: 'error'
        });
    });
}

async function loadList(prms){

    var cnfg = {
        load: true,
        view: "",
        viewpart: false,
        empty: true,
        module: null,
        filter: [],
        page: 1,
        data: {}, 
        success_: null,
    };

    // merge prms with default config
    $.extend(cnfg, prms);

    if( ! cnfg.module ) 
        return;

    //cnfg.module.success_ = cnfg.success_;

    if( ! cnfg.viewpart ) lastList = [];

    lastList[cnfg.view] = cnfg;

    $(`${cnfg.view} .dataTable tbody`).html("");
    $(`${cnfg.view} .actions`).html(`<div class="nodata"><i class="fa fa-spinner fa-pulse fa-3x fa-fw" aria-hidden="true"></i> ${ trans_global.loading }</div>`);

    // load data from server
    var result = {};

    if( cnfg.load ){
        cnfg.module.page = cnfg.page;
        cnfg.module.where = cnfg.filter;

        await cnfg.module.list()
        .then(function(result) {

            cnfg.success_(result);

            $(`${cnfg.view} .actions`).html('');

            if( result && result.data && result.data.length == 0 ){
                if( cnfg.empty ){
                    $(`${cnfg.view} .actions`).html(`<div class="nodata"><i class="fa fa-info-circle" aria-hidden="true"></i> ${ trans_global.nodata }</div>`);
                }
            }

            if( result && result.last_page > 1 ){
                if( result.data && result.data.length ){
                    $(`${cnfg.view} .actions`).html(`<ul class="pagination"></ul>`);
                    
                    var size = result.last_page;
                    var page = result.current_page;
                    var step = 10;

                    var $from = 1;
                    var $to = size;

                    var first = false;
                    var last = false;

                    if (size < step * 2 + 6) {            
                        $from = 1;
                        $to = size;
                    } else if (page < step * 2 + 1) {
                        $from = 1;
                        $to = step * 2 + 4;
                        last = true;
                    } else if (page > size - step * 2) {
                        first = true;
                        $from = size - step * 2 - 2;
                        $to = size;
                    } else {
                        first = true;
                        $from = page - step;
                        $to = page + step + 1;
                        last = true;
                    }
                    
                    if( first )
                        $(`${cnfg.view} .actions .pagination`).append(`<li ${ `onclick="paginate(this, 1, '${cnfg.view}')"` } class="page-item"><a class="page-link">1</a></li><li><span>...</span></li>`);

                    for( $i=$from; $i<=$to; $i++ )
                        $(`${cnfg.view} .actions .pagination`).append(`<li ${( $i != page ? `onclick="paginate(this, ${$i}, '${cnfg.view}')"` : '' )} class="${ $i == page ? 'active' : '' } page-item"><a class="page-link">${$i}</a></li>`);

                    if( last )
                        $(`${cnfg.view} .actions .pagination`).append(`<li><span>...</span></li><li ${ `onclick="paginate(this, ${size}, '${cnfg.view}')"` } class="page-item"><a class="page-link">${size}</a></li>`);
                }
            }
        })
        .catch(function (err){
            showMessage({
                title: 'Erreur!',
                text: err.message,
                icon: 'error'
            });
        });
    }

}

function paginate(btn, page=null, view=""){
    //prms = $(btn).parent().attr('oldfilter');
    try{
        //prms = JSON.parse(prms.replace(/'/g, '"'));
        lastList[view].page = page;
        lastList[view].load = true;

        loadList(lastList[view]);
    }catch(e){

    }
}

function filter(prms){    
    //btn, apply=true, page=null, selector_='.dataTable #filter .form-control
    
    var cnfg = {
        view: "",
        form: "",
        apply: true,
    };

    // merge prms with default config
    $.extend(cnfg, prms);

    wherestr = "";

    if( cnfg.apply == true){
        $( cnfg.form ).each(function(){

            _val_ = $(this).val();
            _field_ =  $(this).attr('name');
            _operation_ = $(this).data('operation') || 'like';

            if( _val_ && _val_ != "__-__-____" && _field_ ){
                if( $(this).hasClass('date') ){
                    var tmp_date = _val_.split('-');
                    _val_ = tmp_date[2]+'-'+tmp_date[1]+'-'+tmp_date[0];
                }
                wherestr += ` and ${ _field_ } ${ _operation_ } '%${ _val_ }%'`;
            }

        });
        /*if( page )
            wherestr += 'page='+page;*/
    }
    //loadList($current_module, callback, wherestr);
    try{
        //prms = JSON.parse(prms.replace(/'/g, '"'));
        var flter = lastList[cnfg.view];
        if( flter ){
            flter.filter = wherestr;
            flter.load = true;
            flter.page = 1;
            loadList(flter);
        }
    }catch(e){
        
    }
}

async function loadSelect( prms ){
    // loadData = false, module_, 
    // selectId_, fieldVal, fieldText, fieldLabel, selected=0, 
    // defaultoptions=[], defaultfilter_="", callback_=null 
    
    var cnfg = {
        load: true,
        module: null,
        selectid: '', 
        fieldval: 'id', 
        fieldtext: '',
        otherfields: '',
        selected: 0,
        defaultoptions: [],
        callback: null,
    };

    // merge prms with default config
    $.extend(cnfg, prms);

    if( ! $(cnfg.selectid).length )
        return;

    if( !cnfg.defaultoptions.length )
        cnfg.defaultoptions = [];    

    if( ! cnfg.module )
        return;

    let options = cnfg.defaultoptions;

    if( cnfg.fieldtext.indexOf(',') ){
        $text = cnfg.fieldtext.split(',').join(",' ' ,");
        cnfg.module.fields = cnfg.fieldval+', concat('+$text+') as fieldtext'+cnfg.otherfields;
    }else{
        cnfg.module.fields = cnfg.fieldval+','+cnfg.fieldtext+' as fieldtext'+cnfg.otherfields;
    }

    //cnfg.module.where = cnfg.fieldval+','+cnfg.fieldtext;

    if( cnfg.selected || cnfg.load ){
        if( cnfg.selected )
            cnfg.module.where = " where "+cnfg.fieldval+"=" + cnfg.selected;

        await cnfg.module.query()
        .then(function(data) {
            
            options = options.concat(data);

            if( cnfg.callback )
                cnfg.callback(options);
        })
        .catch(function (err){ });
    }
    
    // new code just for optimisation 

    $select = $(cnfg.selectid).selectize({
        valueField: cnfg.fieldval,
        searchField: 'fieldtext',
        labelField: 'fieldtext',
        options: options,
        create: false,
        copyClassesToDropdown: true,
        load: async function(strquery, callback) {
            if (!strquery.length) return callback();
            
            if( cnfg.fieldtext.search(',') > 0 ){           
                //condtn = 'and';
                cnfg.module.where = "where";
                $.each( cnfg.fieldtext.split(','), function(i,f){ 
                    cnfg.module.where += " or "+f+" like '%" + strquery +"%'";
                });
                cnfg.module.where = cnfg.module.where.replace('or ', '');
                //$text = cnfg.fieldtext.split(',').join(" or where like'%");
            }else{
                //filter_ += "&filter["+fieldText+"][value]=" + strquery;
                cnfg.module.where = "where "+cnfg.fieldtext+" like'%"+strquery+"%'";
            }

            await cnfg.module.query()
            .then(function(data) {
                options = cnfg.defaultoptions.concat(data);
                
                callback(options);

                if( cnfg.callback )
                    cnfg.callback(data);
            })
            .catch(function (err){ });
        }
    });

    $selectizes[ cnfg.selectid ] =  $select[0].selectize;
    $select[0].selectize.setValue( cnfg.selected );

    return $selectizes[ cnfg.selectid ];
}


function destroy(btn, module_ , id_, success_=null, error_=null){

    if( ! module_ || ! id_ )
        return;

    showMessage({
        title: trans_global.confirm_delete,
        text: trans_global.confirm_deletetext,
        icon: 'warning',
        showCancelButton: true,
        //showDenyButton: isAdmin(),
        confirmButtonColor: '#d33',
        //denyButtonColor: '#d33',
        confirmButtonText: trans_global.delete,
        cancelButtonText: trans_global.annuler,
        //denyButtonText: trans_global.forcedelete,
    }).then( async (result) => {

        if (result.isConfirmed) {

            await new MainModel().destroy(module_, id_)
            .then(function(object) {
                $('button[filter="false"]').trigger('click');

                if( success_ )
                    success_(object);

            })
            .catch(function (err){
                showMessage({
                    title: 'Erreur!',
                    text: err.message,
                    icon: 'error'
                });

                if( error_ )
                    error_(err);
            });

        } 
        /*else if (result.isDenied) {
            deleteprms.filter = 'force=true';
            await doAjax(deleteprms);
        }*/
    })
}

function tofixed2(nbr, n = 2, verg='.', sep = ' ') {
    nbr = parseFloat(nbr);
    if (!nbr)
        nbr = 0;

    nbr = nbr.toFixed(n) || 0;

    nbr = nbr.replace('.', verg);

    nbr = nbr.replace(/\B(?=(\d{3})+(?!\d))/g, sep);

    return nbr;
}

function badge(object, states){
    var options = {
        0: { class : 'default', text: trans_global.no },
        1: { class : 'primary', text: trans_global.oui }
    };

    if ( object in options)
        object = options[object];
    else
        object = options[0];

    return `<span class="label label-${ object.class }"> ${object.text} </span>`;
}


function closeModal(){
    $("#modalView").modal('hide');
}

function is_numeric(value){
   return typeof value === 'number' && isFinite(value);
}

/**************************************************************************
*
*                       
*                  @End
* 
* 
*************************************************************************/


$(document).ready( async function(){

    // load trans files
    await loadTransFiles();

    if( checkToken() ){

        if( homedata.aswindow == false || ( homedata.aswindow && homedata.asmodal == false ) ){
            if( ! homedata.without || homedata.without.indexOf('header') == -1 )
                await loadView({
                    view: '#titlebar',
                    module: 'header',
                    subview: true,
                    trace: false,
                });
        }

        if( homedata.aswindow ){
            homedata.aswindow = false;
        }
        
        await loadView(homedata);
        checkPermission();
        profileInfo();
    }
    
    $('#modalView').on('hidden.bs.modal', function () {
        $("#modalView .modal-body").html("");
    });
    $('#modalPrices').on('hidden.bs.modal', function () {
        $("#modalPrices .modal-body").html("");
    });

})
.off('click','#loginSubmit')
.on('click','#loginSubmit', async function(){
    login();

    return;

    /*if( $data && $data.user && $data.user.id ){

        if( ( $data.session && $data.session.id ) || $data.user.caisse_owner != 1 ) {
            // has already a session opned today OR this user not caisse owner
            window.location.reload();
        }else{
            // no session crete one
            loading(0);
            return showMessage({
                title: 'Le montant dans la caisse',
                html: `<input type="number" id="caisse_count" class="swal2-input" step="0.01">`,
                focusConfirm: false,
                allowEscapeKey : false,
                allowOutsideClick: false,
                preConfirm: () => {
                    const caisse_count = Swal.getPopup().querySelector('#caisse_count').value
                    return { caisse_count: caisse_count}
                }
            }).then(async (result) => {
                log(result);
                if (result.isConfirmed) {
                    await doAjax({
                        module: 'pos',
                        action: 'opensession',
                        data:{
                            caisse: result.value.caisse_count
                        },
                        success_: function(session){
                            if( session && session.id ){
                                window.location.reload();
                            }
                        }
                    });
                }
            });
        }*/


        /*return doAjax({
            module: 'pos',
            action: 'opensession',
            success_: function(session){
                if( session && session.id ){
                    window.location.reload();
                }else{

                    //clearStorage();
                }
            }
        });
    }*/
})
.off('click','.logout')
.on('click','.logout',function(){

    showMessage({
        title: "Se déconnecter, Êtes-vous sûr ?",
        icon: "warning",
        showCancelButton: true,
        cancelButtonText: trans_global.annuler
    }).then(async (result) => {
        if (result.isConfirmed) {
            /*await doAjax({
                module: 'pos',
                action: 'closesession',
                success_: function(session){
                    if( session && session.id ){
                        logout();
                    }
                }
            });*/
            logout();
        }
    });
})
.off('click','[loadView]')
.on('click','[loadView]',async function(){
    //$(this).css('pointerEvents','none');
    //$(this).find('a').css('pointerEvents','none');
    $('[loadView]').removeClass('active');
    $('[loadView]').closest('.dropdown').removeClass('active');
    $(this).closest('.dropdown').addClass('active');
    $(this).addClass('active');
    
    var [module_, action_, params_] = $(this).attr('loadView').split(',');
    var view_ = $(this).data('view') || '#mainpage';
    var modalView_ = $(this).data('view') || '#modalView';
    var asmodal_ = $(this).data('asmodal') ? true : false ; 
    var modalSize_ = $(this).data('modalsize') || 'md';
    var subview_ = $(this).data('subview') ? true : false ;
    var aswindow_ = $(this).data('aswindow') ? true : false ; 
    var without_ = $(this).data('without'); 
    
    if( params_ ){
        if( params_.indexOf('{') >= 0 ){
            try{
                params_ = JSON.parse(params_.replace(/;/g, ',').replace(/'/g, '"'));
            }catch(error) {
                console.error(error);
            }
        }else{
            params_ = {id: params_};
        }
    }else{
        params_ = null;
    }

    //params_.id = params_.id || null;
    
    return await loadView({
        view: view_,
        module: module_,
        action: action_,
        params: params_,
        asmodal: asmodal_,
        subview: subview_,
        modalView: modalView_,
        modalSize: modalSize_,
        aswindow: aswindow_,
        without: without_,
    });

})
.off('click','[destroy]')
.on('click','[destroy]',function(){
    var [module_, id_, callback_] = $(this).attr('destroy').split(',');
    destroy( this, module_, id_, window[callback_]);
})
.off('click','[filter]')
.on('click','[filter]',function(){

    filter({ 
        view: $(this).attr('filter-view'),
        form: $(this).attr('filter-form'),
        apply: $(this).attr('filter') == 'true' ? true : false, 
    })

})
.off('keyup','.dataTable thead input')
.on('keyup','.dataTable thead input', function (e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
        $(this).closest('tr').find('button[filter="true"]').trigger( "click" );
    }
});