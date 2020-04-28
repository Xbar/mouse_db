//define some sample data
var tabledata = [];
var columns = [];
var table, subTable;
var cellcolor = {};
var selected = [];
var open_pos = '';

var colorEditor = function(cell, onRendered, success, cancel, editorParams){
    var editor = document.createElement("input");
    //create and style input
    editor.style.padding = "3px";
    editor.style.width = "100%";
    editor.style.boxSizing = "border-box";

    editor.value = cell.getValue();

    onRendered(function(){
        editor.focus();
        editor.style.css = "100%";
    });

    var isColor = function(strColor) {
        var s = new Option().style;
        s.color = strColor;
        return s.color == strColor;
    };

    //when the value has been set, trigger the cell to update
    function successFunc(){
        if (isColor(editor.value)) {
            cage = cell.getRow().getData().loc;
            id = cell.getRow().getData().id;
            table.getData().forEach(function(value){
                if (value['loc'] == cage && value['id'] != id) {
                    table.updateData([{id:value['id'], color:editor.value}]);
                }
            });
            $.post('data/layout', 
                {'op':'color', 'op1':editor.value, 'op2':'["' + cage + '"]'}, 
                function(data){
                    if (data == 'ok'){
                        success(editor.value);
                    } else {
                        cancel();
                    }
                })
        } else {
        cancel();
        }
    }

    editor.addEventListener("change", successFunc);
    editor.addEventListener("blur", successFunc);

    //return the editor element
    return editor;
};

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
        {title:"Cage", field:"loc"},
        {title:"Color", field:"color", formatter:'color', editor:colorEditor, sorter:'string'},
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
