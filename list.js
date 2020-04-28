//define some sample data
var tabledata = [];
var columns = [];
var table, subTable;
var cellcolor = {};
var selected = [];
var open_pos = '';

var make_table = function(data){
    table = new Tabulator("#main-table", {
        height: '80%', // set height of table (in CSS or here), this enables the Virtual DOM and improves render speed dramatically (can be any valid css height value)
        data:data, //assign data to table
        //reactiveData:true,
        layout:"fitColumns", //fit columns to width of table (optional)
        columns:[{title:"Ear Tag", field:"tag", mutator:tagMutator},
        {title:"Sex", field:"sex",},
        {title:"Genotype", field:"genotype"},
        {title:"Birth date", field:"birth", hozAlign:"center", sorter:"date", sorterParams:{format:"YYYY-MM-DD"}},
        {title:"Parent Male", field:"parentM"},
        {title:"Parent Female", field:"parentF"},
        {title:"Death date", field:"death", hozAlign:"center", sorter:"date", sorterParams:{format:"YYYY-MM-DD"}},
        ], 
        resizableColumns:false,
    });
};

var tagMutator = function(value, data, type, params, component){
    if ((!value) || (!value.trim())) {
        return 'NoTag';
    }
	return value;
};

$.get({
    url: '/data/list',
    crossDomain:true,
    success: function(data) {
        tabledata = data;
    },
}).done(function(){
    make_table(tabledata);
})

$(document).ready(function(){
    $('[data-toggle="tooltip"]').tooltip();
  });
