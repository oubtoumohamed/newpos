var mysql = require('mysql');

var $dbconfig = {
  host     : 'localhost',
  user     : 'root',
  password : '123456',
  database : 'pos',
  multipleStatements: true
};

const connection = mysql.createConnection($dbconfig);

class MainModel {

   constructor(t) {
      this.table = t;
      this.limit = 50;
      this.page  = 1;
      this.select  = '*';
      this.orderby  = 'id';
      this.orderdir  = 'DESC';
   }

   async open(){
      // connect to mysql
      return connection.connect(function(err) {
         // in case of error
         if(err){
            console.log(err.code);
            console.log(err.fatal);
         }
      });
   }

   async close(){
      // Close the connection
      return connection.end(function(){
         // The connection has been closed
      });
   }

   async query() {
      var $query = `SELECT ${ this.fields } FROM ${this.table} ${ this.where || '' } ORDER BY id DESC ${this.limit ? 'LIMIT '+this.limit : ''};`;
      log( $query )
      return new Promise(function(resolve, reject) {
         connection.query($query, function(err, rows, fields) {
            if(err){
               return reject(err);
            }

            resolve(rows);
         });
      });
   }

   async find(id, field="id", operation="=") {

      var $query = `SELECT * FROM ${this.table} where ${ field } ${ operation } '${ id }' ORDER BY id DESC LIMIT 1;`;

      return new Promise(function(resolve, reject) {
         connection.query($query, function(err, rows, fields) {
            if(err){
               return reject(err);
            }

            var object = {};

            if( rows && rows[0] ){
               object = rows[0];
            }

            resolve(object);

         });
      });
   }

   async list() {
      this.offset = (this.page-1) * this.limit;
      var $this = this;

      var $query = `SELECT SQL_CALC_FOUND_ROWS ${this.select} FROM ${this.table} where 1 ${ this.where } ORDER BY ${ this.orderby } ${ this.orderdir } LIMIT ${this.limit} OFFSET ${this.offset}; SELECT FOUND_ROWS() as total limit 1;`;
      console.warn($query);
      return new Promise(function(resolve, reject) {
         connection.query($query, $this.where, function(err, rows, fields) {
            if(err){
               return reject(err);
            }

            var total = rows[1][0].total;
            var max_page = total / $this.limit;

            if( max_page < 1 ){
               max_page = 1;
            }else if( max_page > parseInt(max_page) ){
               max_page = parseInt(max_page) + 1;
            }

            var result = {
               data: rows[0],
               last_page: max_page,
               current_page: $this.page,
               total: total,
            }

            resolve(result);
         });
      });
   }

   async save(data) {
      //var model = this.params;
      data['updated_at'] = getdate('Y-m-d H:i:s');
      var id = data.id;
      var $that = this;

      delete data.id;

      let query = `UPDATE ${ this.table } SET ${ Object.entries(data).map((f) => f[0]+' = '+(f[1] == null ? null : '\''+f[1]+'\'') ).join(',') } where id = ${ id };`;
      
      console.log(query);
      
      return new Promise(function(resolve, reject) {
         connection.query(query, async function(err, result, fields) {
            if(err){
               return reject(err);
            }

            resolve( await $that.find( id ) );
         });
      });
   }

   async destroy(table, id) {

      let query = `DELETE FROM ${ table }s where id = ${ id }`;
      
      return new Promise(function(resolve, reject) {
         connection.query(query, function(err, result, fields) {
            if(err){
               return reject(err);
            }

            resolve(result);
         });
      });      
   }

   async checkRefExist($from) {

      var $ref = ''+($from+1);

      $ref = $ref.padStart(4, '0');

      $ref = getdate('Ym') +''+ $ref;

      var $ref_check = 0; //self::where('reference',$ref)->first();

      if($ref_check){
         //return  self::checkRefExist($from+1);
      }

      return $ref;
   }

   async refgenerate($col = 'id') {
      var $that = this;
      var $query = `SELECT count(id) as nbr FROM ${this.table} where created_at like '${ getdate('Y-m-d') }%' order by created_at desc LIMIT 1;`;

      return new Promise(function(resolve, reject) {
         connection.query($query, async function(err, rows, fields) {
            var count = 0;

            if( rows && rows[0] && rows[0].nbr ){
               count = rows[0].nbr;
            }

            resolve( await $that.checkRefExist( count ) );

         });
      });
   }

   async create(data) {
      var $that = this;
      //var model = this.params;
      data['created_at'] = getdate('Y-m-d H:i:s');

      delete data.id;
      
      var colmns = Object.keys(data);
      var values = Object.values(data);

      let query = `INSERT INTO ${ this.table }(${ colmns.join(',') }) VALUES(${ colmns.map((k) => '?').join(',') })`;
      console.log(query, values)
      return new Promise(function(resolve, reject) {
         connection.query(query, values, async function(err, result, fields) {
            if(err){
               return reject(err);
            }

            resolve( await $that.find(result.insertId) );
         });
      });
   }
}

class Achat extends MainModel {
   table = "achats";

   async products(id) {

      var $query = `
      SELECT 
         achat_products.*,
         products.reference, products.name, products.price, products.purchase_price
      FROM achat_products
      LEFT JOIN products 
         ON achat_products.product_id = products.id
      where achat_products.achat_id = ${ id };`;

      return new Promise(function(resolve, reject) {
         connection.query($query, function(err, rows, fields) {
            if(err){
               return reject(err);
            }

            resolve(rows);

         });
      });
   }

   async reglements(id) {

      var $query = `SELECT achat_reglements.*, concat( users.firstname, ' ', users.lastename ) as employee FROM achat_reglements LEFT JOIN users on achat_reglements.user_id = users.id where achat_id = ${ id } order by id desc;`;

      return new Promise(function(resolve, reject) {
         connection.query($query, function(err, rows, fields) {
            if(err){
               return reject(err);
            }

            resolve(rows);

         });
      });
   }

   async addProduct(id, product) {

      var $achat = {};
      try{

         await connection.beginTransaction();

         await new AchatProduct().create(product)
         .then(async (product)=>{

            await super.find(id)
            .then( async (achat)=>{

               var $montant = parseFloat( product.prix * product.quantite ) || 0;
               var $montant_tva = parseFloat( ( product.tva * $montant ) / 100 ) || 0;

               var data = {
                  id: achat.id,
                  montant_ht: parseFloat( achat.montant_ht + $montant ),
                  montant_ttc: parseFloat( achat.montant_ttc + ( $montant + $montant_tva ) ),
               };

               if( data.montant_paye >= achat.montant_ht ){
                  data.etat = 'payed';
               }

               $achat = await super.save(data);
            });

         });

         await connection.commit();

      }catch ($th) {
         await connection.rollback();
      }

      return $achat;
   }

   async addReglement(id, reglement) {

      var $achat = {};
      try{

         await connection.beginTransaction();

         await new AchatReglement().create(reglement)
         .then(async (reglement)=>{

            await super.find(id)
            .then( async (achat)=>{

               var data = {
                  id: achat.id,
                  montant_paye: achat.montant_paye + reglement.montant,
               };

               if( data.montant_paye >= achat.montant_ht ){
                  data.etat = 'payed';
               }else if( achat.etat == 'cree' ){
                  data.etat = 'encours';
               }

               $achat = await super.save(data);
            });

         });

         await connection.commit();

      }catch ($th) {
         await connection.rollback();
      }

      return $achat;
   }

}

class AchatProduct extends MainModel {
   table = "achat_products";
}

class AchatReglement extends MainModel {
   table = "achat_reglements";
}

class Reglement extends MainModel {
   table = "reglements";
}

class Order_product extends MainModel {
   table = "order_products";
}

class Product extends MainModel {
   table = "products";
}

class Shelf extends MainModel {
   table = "shelfs";
}

class Categorie extends MainModel {
   table = "categories";
}

class Client extends MainModel {
   table = "clients";
}

class Supplier extends MainModel {
   table = "suppliers";
}

class Groupe extends MainModel {
   table = "groupes";
}

class Charge extends MainModel {
   table = "charges";
}

class Session extends MainModel {
   table = "pos_sessions";

   async caisse(data) {
      var $that = this;

      var $date = '';

      if( data.date ){
         var tmp_date = data.date.split('-');
         $date = tmp_date[2]+'-'+tmp_date[1]+'-'+tmp_date[0];
      }else{
         $date = getdate('Y-m-d');
      }

      var $session = await this.find( $date+'%', 'open_at', 'like');

      // calc orders

      var $order_ = new Order();
      $order_.limit = '';
      $order_.sumamount = 0;
      $order_.fields = 'amount';
      $order_.where = `where date >= '${ $date } 00:00:00' and  date <= '${ $date } 23:59:59'`;

      await $order_.query()
      .then(async function(orders) {
         //
         $.each(orders, function(k, v){
            $order_.sumamount += v.amount;
         })
      })
      .catch(function (err){ console.error( err ) });
      var $amount = $order_.sumamount;

      // calc charges

      var $charges = [];

      var $charge_ = new Charge();
      $charge_.limit = '';
      $charge_.sumamount = 0;
      $charge_.fields = 'montant';
      $charge_.where = `where created_at >= '${ $date } 00:00:00' and  created_at <= '${ $date } 23:59:59'`;
      await $charge_.query()
      .then(async function(charges) {
         //
         $charges = charges;
         $.each(charges, function(k, v){
            $charge_.sumamount += v.montant;
         })
      })
      .catch(function (err){ console.error( err ) });

      var $total_charges = $charge_.sumamount;

      // calc Reglement

      var $reglement_ = new Reglement();
      $reglement_.limit = '';
      $reglement_.sumamount = 0;
      $reglement_.fields = 'montant';
      $reglement_.where = `where created_at >= '${ $date } 00:00:00' and  created_at <= '${ $date } 23:59:59'`;

      await $reglement_.query()
      .then(async function(charges) {
         //
         $.each(charges, function(k, v){
            $reglement_.sumamount += v.montant;
         })
      })
      .catch(function (err){ console.error( err ) });

      var $total_reglements = $reglement_.sumamount;

      return {
         caisse   : $session && $session.caisse ? $session.caisse : 0,
         open_at  : $session && $session.open_at ? $session.open_at : $date,
         amount   : $amount,
         reglements   : $total_reglements,
         payed    : ( ( $session && $session.caisse ? $session.caisse : 0 ) + $total_reglements ) - $total_charges,
         charges  : $charges,
         total_charges  : $total_charges,
      };
   }
}

class User extends MainModel {
   table = "users";

   async login( cnfg ){
      var $query = `SELECT * FROM ${this.table} where username = '${cnfg.username}' and password = '${cnfg.password}' LIMIT 1;`;
      // $2y$10$SnP/5zSPBVzA3q5wVdWQ8O3Y5/IrMrLlkuUktT90oVlk/QUnOU3ni
      return new Promise(function(resolve, reject) {
         connection.query($query, function(err, rows, fields) {
            if(err){
               return reject(err);
            }
            rows = rows ? rows[0] : {};
            resolve(rows);
         });
      });
   }

   async opensession( cnfg ){
      /*
        $session = PosSession::where([
            ['user_id', auth()->user()->id],
            ['close_at', null]
        ])->first();

        if( ( !$session || !$session->id ) && $request->caisse){
         $session = PosSession::create([
               'user_id' => auth()->user()->id,
               'caisse' => $request->caisse,
               'open_at' => date('Y-m-d H:i:s'),
               'close_at' => null
         ]);
        }

      var $query = `SELECT * FROM ${this.table} where username = '${cnfg.username}' and password = '${cnfg.password}' LIMIT 1;`;
      // $2y$10$SnP/5zSPBVzA3q5wVdWQ8O3Y5/IrMrLlkuUktT90oVlk/QUnOU3ni
      return new Promise(function(resolve, reject) {
         connection.query($query, function(err, rows, fields) {
            if(err){
               return reject(err);
            }
            rows = rows ? rows[0] : {};
            resolve(rows);
         });
      });*/
   }
}


class Order extends MainModel {
   table = "orders";

   async checkout( cnfg ){

      var $type = cnfg.type; // 'bl' or 'bc'

      var $avoired = cnfg.avoired ? -1 : 1 ;
      var $client_id = cnfg.client_id;
      var $supplier_id = cnfg.supplier_id;
      var $payed = parseFloat( cnfg.payed.toFixed(2) );
      var $total = parseFloat( cnfg.total.toFixed(2) );
      var $products = cnfg.products;
      var $order_notes = cnfg.order_notes ?  cnfg.order_notes :  '';

      var $msg = '';
      var $flash_type = 'error';
      var $order_ = null;
    
      var $facture_html = '';
      var $boncommande_html = '';

      if( $products && Array.isArray($products) ){
         if( $avoired == -1 ){
            $total *= $avoired;
            $payed = 0;
         }

         if( $avoired == 1 && $client_id ){

            var $client = await new Client().find($client_id);

            if( $client && $client.id && $client.plafond > 0 ){
               var $plafond = 0;
               /*

               TODO : 

               $plafond = $total - $payed;
               $orders = Order::where([
                  ['client_id', $client->id],
                  ['state', '!=', 'payed'],
               ])->get();

               foreach ($orders as $order) {
                  //if( $order->amount > $order->payed ){
                  $plafond += ( $order->amount - $order->payed );
                  //}
               }*/

               if( $plafond <= $client.plafond){
                  // order will create normallu
               }else{
                  $msg = 'le client a une plafond de <b>'+ tofixed2( $client.plafond )+' DH</b> <br><br>  le crédit : <b>' + tofixed2( $plafond - ( $total - $payed ) ) + ' DH</b>';
                  $flash_type = 'error';
               }
            }else{
               $client_id = 0;
            }
         }else if( $avoired == -1 && $client_id ){
            $msg = 'Tant que vous avez le client,<br> essayer d\'tiliser l\'option <br><b>"Retour avancé"</b>';
            $flash_type = 'error';
         }
         
         try {

            await connection.beginTransaction();

            var $ahat_products = [];

            var $order = {};
            var $order_products = [];

            await this.create({
               reference: await this.refgenerate('reference'),
               amount: $total,
               payed: $payed,
               user_id: auth().id,
               client_id: $client_id > 0 ? $client_id : null,
               date: getdate('Y-m-d H:i:s'),
               state:  $avoired == -1 ? 'avoired' : 'created',
               notes: $order_notes,
               type: $type,
               supplier_id: $supplier_id,
            })
            .then(function(object) {
               $order = object;
            })
            .catch(function (err){
               showMessage({
                  title: 'Erreur!',
                  text: "S'il vous plaît essayer encore",
                  icon: 'error'
               });
            });


            if( $order && $order.id && $payed && $payed > 0 ){
               var $reglement = new Reglement().create({
                  order_id  : $order.id,
                  user_id   : auth().id,
                  montant   : $payed,
                  type      : 'espece',
                  commantaire: 'Systeme'
               });
            }

            var $achat_montant_ttc = 0; // POS BC only

            for( var $id in $products ) { 
               var $item = $products[ $id ];

               var $product = {};

               if( is_numeric( $item['id'] ) ){
                  $product = await new Product().find( $item['id'] );
               }else{
                  // is new product => create it and his achat
                  await new Product().create({
                     reference     :  $item['reference'],
                     name          :  $item['name'],
                     price         :  $item['price'],
                     purchase_price:  $item['purchase_price'],
                     supplier_id   :  $item['supplier_id'],
                     stock         :  $item['quantity'],
                  })
                  .then(function(object) {
                     $product = object;
                  });

                  if( $product && $product.id ){
                     $ahat_products.push( $product );
                     $achat_montant_ttc += ( $product.price * $product.stock );
                  }
               }

               if( $product && $product.id && $product.stock >= $item['quantity'] ){
                 
                  var $achatArticle = null;
                 
                  if( $item['achat'] ){
                     $achatArticle = await new AchatProduct().find($item['achat']);
                     if( $achatArticle && $achatArticle.id ){
                        await $achatArticle.save({
                           id: $achatArticle.id,
                           quantite_vendu: $achatArticle.quantite_vendu + $item['quantity']
                        });
                     }
                  }

                  await new Order_product().create({
                     order_id       : $order.id,
                     product_id     : $product.id,
                     qty            : $item['quantity'],
                     price          : $item['price'] * $avoired,
                     discount       : $item['discount'],
                     devis_achat_id : $achatArticle && $achatArticle.id ? $achatArticle.id : null,
                  })
                  .then(function(object) {
                     object.product = $product;
                     $order_products.push( object );
                  });
                  //$product->name = $item['name'];
                  //$product->stock = $product->stock - $item['quantity'];

                  // Update stock 
                  await new Product().save({
                     id : $product.id,
                     stock : $product.stock - $item['quantity'],
                  });
               }
            }

            $msg = 'la commande a été créé avec succès.';
            $flash_type = 'success';

            if( $type == 'bc' && $ahat_products && $ahat_products.length ){

               var $achat_ref = await new Achat().refgenerate();
               var $achat_date = getdate('Y-m-d H:i:s');

               var $devis = {};

               await new Achat().create({
                  reference_devis           : $achat_ref,
                  date_devis                : $achat_date,
                  objet_devis               : 'POS BC',
                  etat_devis                : 'Valider',
                  employe_validate_devis    : auth().id,
                  media_id                  : null,

                  reference_commande        : $achat_ref,
                  date_creation_commande    : $achat_date,
                  date_validation_commande  : $achat_date,
                  condition_commande        : '',
                  etat_commande             : 'Valider',
                  type_commande             : null,
                  montant_ht                : $achat_montant_ttc,
                  montant_ttc               : $achat_montant_ttc,
                  employe_validate_commande : auth().id,

                  reference_bl              : $achat_ref,
                  date_creation_bl          : $achat_date,
                  date_validation_bl        : $achat_date,
                  condition_bl              : '',
                  etat_bl                   : 'Valider',
                  paye_bl                   : '',
                  employe_validate_bl       : auth().id,
               })
               .then(function(object) {
                  $devis = object;
               });

               for( var $art in  $ahat_products ){
                  var $article = $ahat_products[ $art ];

                  await new AchatProduct().create({
                     quantite : $article.stock,
                     quantite_livrer : $article.stock,
                     quantite_vendu : $article.stock,
                     prix : $article.purchase_price,
                     prix_vent : $article.price,
                     product_id : $article.id,
                     achat_id : $devis.id,
                  });
               }
               $msg = 'le bon de commande a été créé avec succès.';
            }
            
            $order_ = $order;

            $facture_html = await this.getfacturehtml($order_, $order_products);
            $boncommande_html = await this.getfacturehtml($order_, $order_products, 1);

            await connection.commit();

         } catch ($th) {
            await connection.rollback();
            console.log( $th );
            $msg = $th;
            $flash_type = 'error';
         }
      }

      var $return = {
         'order' : $order_,
         'facture':$facture_html,
         'boncommande':$boncommande_html,
         'type':$type,
      };

      if( $flash_type == 'error' )
         $return.error = $msg;
      else
         $return.success = $msg;


      return $return;
   }

   async find(id, field='id') {
      var $query = `
      SELECT 
         orders.*, 
         clients.name as client,
         concat( users.firstname, ' ', users.lastename ) as employee
      FROM ${this.table} 
      LEFT JOIN clients 
         ON clients.id = orders.client_id
      LEFT JOIN users 
         ON users.id = orders.user_id
      where orders.${ field } = '${ id }' LIMIT 1;`;

      return new Promise(function(resolve, reject) {
         connection.query($query, function(err, rows, fields) {
            if(err){
               return reject(err);
            }

            var object = {};

            if( rows && rows[0] ){
               object = rows[0];
            }

            resolve(object);

         });
      });
   }

   async save(data) {
      await super.save(data)
      .then( async (object) => {
         if( object.creditdelay == null && object.amount <= object.payed ){
            var obj = {
               id: object.id,
               state : 'payed',
            };
            await super.save( obj );
         }
      });
   }

   async products(id) {

      var $query = `
      SELECT 
         order_products.*,
         products.reference, products.name, products.purchase_price
      FROM order_products
      LEFT JOIN products 
         ON order_products.product_id = products.id
      where order_products.order_id = ${ id };`;

      return new Promise(function(resolve, reject) {
         connection.query($query, function(err, rows, fields) {
            if(err){
               return reject(err);
            }

            resolve(rows);

         });
      });
   }

   async reglements(id) {

      var $query = `SELECT reglements.*, concat( users.firstname, ' ', users.lastename ) as employee FROM reglements LEFT JOIN users on reglements.user_id = users.id where order_id = ${ id } order by id desc;`;

      return new Promise(function(resolve, reject) {
         connection.query($query, function(err, rows, fields) {
            if(err){
               return reject(err);
            }

            resolve(rows);

         });
      });
   }

   async addReglement(id, reglement) {

      var $order = {};
      try{

         await connection.beginTransaction();

         await new Reglement().create(reglement)
         .then(async (reglement)=>{

            await super.find(id)
            .then( async (order)=>{

               var data = {
                  id: order.id,
                  payed: order.payed + reglement.montant,
               };

               if( data.payed >= order.amount ){
                  data.state = 'payed';
               }

               $order = await super.save(data);
            });

         });

         await connection.commit();

      }catch ($th) {
         await connection.rollback();
      }

      return $order;
   }

   async avoired(prms){

      var $return = {
         'state' : 'success', 
         'msg' : 'Le produit marque comme retour.',
      };

      var $qty_avoired = parseFloat( prms.qty_avoired );
      var $prix_avoired = parseFloat( prms.prix_avoired );

      var order = {};
      var order_product = {};

      await new Order_product().find(prms.prdid)
      .then(async function(op) {
         order_product = op;
      });

      await this.find(prms.id)
      .then(async function(o) {
         order = o;
      });

      if( order.id && order_product.id ){

         if( $qty_avoired > 0 ){

            await connection.beginTransaction();

            await new Order_product().save({
               id: order_product.id,
               avoired: 1,
               qty_avoired: order_product.qty_avoired + $qty_avoired,
               price_avoired: order_product.price_avoired + $prix_avoired,
               user_id: auth().id
            })
            .then(function(object) { })
            .catch(function (err){
               $return = {
                  'state' : 'error', 
                  'msg' : err.message,
               };
            });

            await this.save({
               id: order.id,
               amount: order.amount - ( order_product.price * $qty_avoired )
            })
            .then(function(object) { })
            .catch(function (err){
               $return = {
                  'state' : 'error', 
                  'msg' : err.message,
               };
            });

            if( $prix_avoired > 0 ){
               await new Reglement().create({
                  order_id : order.id,
                  user_id  : auth().id,
                  montant  : $prix_avoired * -1,
                  type     : 'espece',
                  commantaire: 'Systeme Avoirs'
               })
               .then(function(object) { })
               .catch(function (err){
                  $return = {
                     'state' : 'error', 
                     'msg' : err.message,
                  };
               });
            }

            await connection.commit();

         }else{
            $return = {
               'state' : 'error', 
               'msg' : 'Qté doit être supérieur a : 0',
            };
         }
      }else{
         $return = {
            'state' : 'error', 
            'msg' : 'Erreur',
         };
      }

      return $return;
   }

   async getfacturehtml($that, $products, $is_bc = 0){

      var $content_ = `
      <div style="width: 48%; display: inline-block; float: left; padding: 0 1%;">
      <table>
         <tbody>
             <tr>
                 <td> <img style="width: 100px;" src="../assets/img/logo-pos.png" /> </td>
                 <td style="width: 50%; text-align: center;">
                     <h1><b>${ $that.type == 'bc' && $is_bc == 0 ? 'Bon de Commande' : 'Bon de Livraison' }</b></h1>
                     <b>${ $is_bc == 1 ? $that.supplier : '' }</b>
                 </td>
                 <td>
                     <div style="margin-bottom: 5px;" >Référence : <b>${ $that.reference }</b> </div>
                     <div style="margin-bottom: 5px;" >Date : ${ dateFomat($that.date) }</div>
                     <div style="margin-bottom: 5px;" >Client : <b>${ $that.client || '' }</b></div>
                     <div>Notes : ${ $that.notes }
                 </td>
             </tr>
         </tbody>
      </table>
  
      <style> *{color-adjust: exact;  -webkit-print-color-adjust: exact; print-color-adjust: exact;} body, html{ font-family: sans-serif; font-size: 11px; } @page { font-family: sans-serif; font-size: 11px; } .ptble tbody tr:nth-child(even) {background-color: #f2f2f2; } </style>
      <table class="maintblpage table table-striped table-bordered table-hover" style="width: 100%; border-collapse: collapse;">
         <thead>
             <tr style="background: #ddd; border: solid 1px #6e6e6e42; text-align: center;">
                 <td style="border-bottom: solid 1px #6e6e6e42; padding: 5px; width: 15%;">Référence</td>
                 <td style="border-bottom: solid 1px #6e6e6e42; padding: 5px; width: 45%;">Designation</td>
                 ${ $that.type == 'bc' && $is_bc == 0 ? '' : '<td style="border-bottom: solid 1px #6e6e6e42; padding: 5px; width: 15%;">Prix U.</td>' }
                 <td style="border-bottom: solid 1px #6e6e6e42; padding: 5px; width: 10%;">Qté.</td>
                 ${ $that.type == 'bc' && $is_bc == 0 ? '' : '<td style="border-bottom: solid 1px #6e6e6e42; padding: 5px; width: 15%;">Total</td>' }
             </tr>
         </thead>
         <tbody>`;

         $products.forEach(function($op){ 
            $content_ += `
                <tr style="border-left: solid 1px #6e6e6e42;">
                    <td class="ptext" style="border-bottom: solid 1px #6e6e6e42; border-right: solid 1px #6e6e6e42; padding: 5px; width: 15%;">${ $op.product ? $op.product.reference : $op.reference }</td>
                    <td class="ptext" style="border-bottom: solid 1px #6e6e6e42; border-right: solid 1px #6e6e6e42; padding: 5px; width: 45%;">${ $op.product ? $op.product.name : $op.name }</td>
                    ${ $that.type == 'bc' && $is_bc == 0 ? '' : '<td class="ptext" style="border-bottom: solid 1px #6e6e6e42; border-right: solid 1px #6e6e6e42; padding: 5px; text-align: right; width: 15%;">'+tofixed2( $op.price )+'</td>' }
                    <td class="ptext" style="border-bottom: solid 1px #6e6e6e42; border-right: solid 1px #6e6e6e42; padding: 5px; text-align: center;width: 10%;">${ $op.qty }</td>
                    ${ $that.type == 'bc' && $is_bc == 0 ? '' : '<td class="pnum"  style="border-bottom: solid 1px #6e6e6e42; border-right: solid 1px #6e6e6e42; padding: 5px; width: 15%; text-align: right; white-space: nowrap;"><strong>'+ tofixed2( $op.qty * $op.price ) +'</strong></td>' }
                </tr>`;
         });

         if( $that.type == 'bc' && $is_bc == 0 ){

         }else{
        
            $content_ += `
            <tr style="height: 17px;">
               <td style="height: 17px; border-top: none; border-bottom: none; border-left: none; border-image: initial; border-right: none !important; background: #fff;"></td>
               <td style="height: 17px; border-top: none; border-bottom: none; border-left: none; border-image: initial; border-right: none !important; background: #fff;"></td>
               <td style="height: 17px; border-top: none; border-bottom: none; border-left: none; border-image: initial; border-right: none !important; background: #fff;"></td>
               <td class="psubtext" style=" border-bottom: solid 1px #6e6e6e42; white-space: nowrap; border-left: solid 1px #6e6e6e42; padding: 5px; height: 17px;">Total</td>
               <td class="psubnum" style=" border-bottom: solid 1px #6e6e6e42; white-space: nowrap;  border-right: solid 1px #6e6e6e42; border-left: solid 1px #6e6e6e42; padding: 5px; height: 17px; text-align: right; font-weight: bold;">${ tofixed2($that.amount) } DH</td>
            </tr>
            <tr style="height: 17px;">
               <td style="height: 17px; border-top: none; border-bottom: none; border-left: none; border-image: initial; border-right: none !important; background: #fff;"></td>
               <td style="height: 17px; border-top: none; border-bottom: none; border-left: none; border-image: initial; border-right: none !important; background: #fff;"></td>
               <td style="height: 17px; border-top: none; border-bottom: none; border-left: none; border-image: initial; border-right: none !important; background: #fff;"></td>
               <td class="psubtext" style="white-space: nowrap; border-left: solid 1px #6e6e6e42; border-bottom: solid 1px #6e6e6e42; padding: 5px; height: 17px;">Payée</td>
               <td class="psubnum" style="white-space: nowrap;  border-right: solid 1px #6e6e6e42; border-left: solid 1px #6e6e6e42; border-bottom: solid 1px #6e6e6e42; padding: 5px; height: 17px; text-align: right; font-weight: bold;"> ${ tofixed2($that.payed) } DH</td>
            </tr>`;
            
            if( ($that.amount - $that.payed) > 0 ){
               $content_ += `<tr style="height: 17px;">
                  <td style="height: 17px; border-top: none; border-bottom: none; border-left: none; border-image: initial; border-right: none !important; background: #fff;"></td>
                  <td style="height: 17px; border-top: none; border-bottom: none; border-left: none; border-image: initial; border-right: none !important; background: #fff;"></td>
                  <td style="height: 17px; border-top: none; border-bottom: none; border-left: none; border-image: initial; border-right: none !important; background: #fff;"></td>
                  <td class="psubtext" style=" border-bottom: solid 1px #6e6e6e42; white-space: nowrap; border-left: solid 1px #6e6e6e42; padding: 5px; height: 17px;">Reste</td>
                  <td class="psubnum" style=" border-bottom: solid 1px #6e6e6e42; white-space: nowrap;  border-right: solid 1px #6e6e6e42; border-left: solid 1px #6e6e6e42; padding: 5px; height: 17px; text-align: right; font-weight: bold;">${ tofixed2($that.amount - $that.payed) } DH</td>
               </tr>`;
            }
        }
        
      $content_ += '</tbody></table></div>';
      //return $content_ . ' <div class="pagebreak"></div> ' . $content_;
      return ''+ $content_ + $content_;
   }
}

(async ()=>{
    


})();


















/*
var sqlite3 = require('sqlite3').verbose();


  let db = new sqlite3.Database('./db/pos.db', (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the chinook database.');
  });
*/
  /*db.serialize(function() {
    db.run(`
      CREATE TABLE users (
        firstname TEXT,
        lastename TEXT,
        login TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT,
        cin TEXT,
        phone TEXT,
        adresse TEXT,
        caisse_owner INTEGER,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    db.run(`
      CREATE TABLE groups (
        name TEXT NOT NULL,
        roles TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    db.run(`
      CREATE TABLE usergroupes (
        user_id INTEGER,
        group_id INTEGER,

        FOREIGN KEY (user_id) 
          REFERENCES users (rowid) 
             ON DELETE CASCADE 
             ON UPDATE NO ACTION,

        FOREIGN KEY (group_id) 
          REFERENCES groups (rowid) 
             ON DELETE CASCADE 
             ON UPDATE NO ACTION
      );
    `);*/

    /*var stmt = db.prepare("INSERT INTO lorem VALUES (?)");
    for (var i = 0; i < 10; i++) {
        stmt.run("Ipsum " + i);
    }
    stmt.finalize();
   
    db.each("SELECT rowid AS id, info FROM lorem", function(err, row) {
        console.log(row.id + ": " + row.info);
    });*/
  //});
   


  //db.close();
