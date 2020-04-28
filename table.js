//define some sample data
var tabledata = [];
var columns = [];
var table, subTable;
var cellcolor = {};
var selected = [];
var open_pos = '';

var add_sub = function() {
    add_sub.id = add_sub.id || -1;
    add_sub.id--;
    subTable.addData([{id: add_sub.id, loc:open_pos, color:add_sub.color}]);
}

var close_sub = function() {
    row = open_pos.match(/\d+/)[0];
    open_pos = '';
    $("#holder-div").remove();
    if (add_sub.id < 0) {
        table.getRow(row).reformat();
    }
}

var upload_sub = function() {
    var data = [], tags = [];
    subTable.getData().forEach(function(value){
        if (value['sex']) {
            data.push(value);
            tags.push(value['tag']);
        }
    })
    $.post('data/layout', {'op':'update', 'op1':open_pos, 
    'op2':JSON.stringify(data)}, function(data){
        if (data == 'ok') {
            tags = tags.join(' ');
            pos = open_pos.match(/\d+|[a-zA-Z]+/g);
            table.getRow(pos[0]).getCell(pos[1]).setValue(tags + '|' + add_sub.color);
            close_sub();
            showMessage('Success');
        } else {
            showMessage(data);
            return;
        }
    })
}

var transfer_sub = function() {
    if (add_sub.id < 0) {
        showMessage('Cannot transfer before saving newly added animals.');
        return;
    }
    if (selected.length != 1) {
        showMessage('Can only specify one cage to transfer to.');
        return;
    }
    var animals = [];
    var left_tags = [], move_tags = [];
    subTable.getData().forEach(function(value){
        if (value['select']) {
            animals.push(value);
            move_tags.push(value['tag']);
        } else {
            left_tags.push(value['tag']);
        }
    });
    
    if (animals.length < 1) {
        return;
    }
    $.post('data/layout', {'op':'transfer', 'op1':selected[0], 'op2': JSON.stringify(animals)},
    function(data){
        if (data == 'ok') {
            pos = open_pos.match(/\d+|[a-zA-Z]+/g);
            
            table.getRow(pos[0]).getCell(pos[1]).setValue(packCell({tag:left_tags, color:add_sub.color}));
            
            pos = selected[0].match(/\d+|[a-zA-Z]+/g);
            values = parseCell(table.getRow(pos[0]).getCell(pos[1]).getValue());
            values.tag = values.tag.concat(move_tags);
            
            table.getRow(pos[0]).getCell(pos[1]).setValue(packCell(values));
            
            close_sub();
            showMessage('Success');
        } else {
            showMessage(data);
            return;
        }
    })
}

var kill_sub = function() {
    if (add_sub.id < 0) {
        showMessage('You must save your changes first');
        return;
    }
    var animals = [];
    var left_tags = [];
    var today = moment().format('YYYY-MM-DD');
    subTable.getData().forEach(function(value){
        if (value['select']) {
            value['death'] = today;
            animals.push(value);
        } else {
            left_tags.push(value['tag']);
        }
    });
    if (animals.length < 1) {
        return;
    }
    $.post('data/layout', {'op':'update', 'op1':open_pos, 'op2': JSON.stringify(animals)},
    function(data){
        if (data == 'ok') {
            pos = open_pos.match(/\d+|[a-zA-Z]+/g);
            left_tags = left_tags.join(' ');
            table.getRow(pos[0]).getCell(pos[1]).setValue(left_tags + '|' + add_sub.color);
            close_sub();
            showMessage('Success');
        } else {
            showMessage(data);
            return;
        }
    })
};

//Create Date Editor
var dateEditor = function(cell, onRendered, success, cancel){
    //cell - the cell component for the editable cell
    //onRendered - function to call when the editor has been rendered
    //success - function to call to pass the successfuly updated value to Tabulator
    //cancel - function to call to abort the edit and return to a normal cell

    //create and style input
    var cellValue = moment(cell.getValue(), "YYYY-MM-DD").format("YYYY-MM-DD"),
    input = document.createElement("input");

    input.setAttribute("type", "date");

    input.style.padding = "4px";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";

    input.value = cellValue;

    onRendered(function(){
        input.focus();
        input.style.height = "100%";
    });

    function onChange(){
        if(input.value != cellValue){
            value = moment(input.value);
            if (value.isValid()) {
                success(value.format("YYYY-MM-DD"));
            } else {
                success(null);
            }
            
        }else{
            cancel();
        }
    }

    //submit new value on blur or change
    input.addEventListener("blur", onChange);

    //submit new value on enter
    input.addEventListener("keydown", function(e){
        if(e.keyCode == 13){
            onChange();
        }

        if(e.keyCode == 27){
            cancel();
        }
    });

    return input;
};


var showMessage = function(text) {
    $(".message").text(text)
    $(".message").fadeIn();
    $(".message").delay(2000).fadeOut();
}

var expandRow = function(row){
    if (open_pos) {
        pos = open_pos.match(/\d+|[a-zA-Z]+/g);
        if (row.getData().id == pos[0]){
            var holderEl = document.createElement("div");
            var tableEl = document.createElement("div");
            tableEl.style.border = "1px solid #333";
            var buttons = document.createElement("div");
            buttons.innerHTML = "<a class='btn' onclick='add_sub()'>Add</a>" + 
            "<a class='btn' onclick='kill_sub()'>Sacrifice</a>" +
            "<a class='btn' onclick='transfer_sub()'>Move</a>" +
            "<span style='margin: 0em 2em'></span>" +
            "<a class='btn' onclick='upload_sub()'>Save</a>" + 
            "<a class='btn' onclick='close_sub()'>Cancel</a>";
            holderEl.id = "holder-div";
            holderEl.appendChild(tableEl);
            holderEl.appendChild(buttons);
            row.getElement().appendChild(holderEl);
            $.get('data/layout', {part: 'cage', cage:open_pos}, function(data){
                subTable = new Tabulator(tableEl, {
                    layout:"fitColumns",
                    data:data,
                    columns:[
                    {title:"Select", field:"select", editor:'tickCross', hozAlign:"center", formatter:'tickCross', formatterParams:{crossElement:false}},
                    {title:"Ear Tag", field:"tag", editor:"input",mutator:tagMutator},
                    {title:"Sex", field:"sex", editor:"select", editorParams:{values:{"M":"M", "F":"F"}}},
                    {title:"Genotype", field:"genotype", editor:"input"},
                    {title:"Birth date", field:"birth", hozAlign:"center", sorter:"date", editor:dateEditor},
                    {title:"Parent Male", field:"parentM", editor:"input"},
                    {title:"Parent Female", field:"parentF", editor:"input"},
                    ]
                });
                add_sub.id = 0;
                if (data.length > 0) {
                    add_sub.color = data[0]['color'];
                } else {
                    add_sub.color = '';
                }
                
            });
        }
    }
}
var tagMutator = function(value, data, type, params, component){
    if ((!value) || (!value.trim())) {
        return 'NoTag';
    }
	return value;
}

var parseCell = function(data) {
    // values = data.split('|');
    // tags = values[0].split(' ');
    // color = values[1];
    // if(!color){
    //     color = '';
    // }
    // return {tag:tags, color:color};
    if (data) {
        return data;
    }
    return {tag:[], color:""};
};

var packCell = function(data) {
    return data;
    //tags = data.tag.join(' ').trim()
    //return tags + '|' + value.color;
};

var cellFormatter = function(cell, formatParams, onRendered) {
    cell_id = cell.getData().id + cell.getField();
    $(cell.getElement()).addClass(cell_id);
    overlay = '<div id="' + cell_id + '" class="selected"></div>'
    cell.getElement().style.whiteSpace = "pre-wrap";
    value = parseCell(cell.getValue());
    if (value.color) {
        $(cell.getElement()).css('background-color', value.color);
    }
    
    content = '<div>' + value.tag.join('</div><div>') + '</div>'
    return overlay + content;
}

var setColor = function(obj) {
    color = $(obj).css('background-color');
    $.post('data/layout',
            {'op': 'color', 'op1': color, 'op2': JSON.stringify(selected)},
            function(data, status, jqXHR) {
                if (data == 'ok') {
                    showMessage('Success');
                } else {
                    showMessage(data);
                    return;
                }
        });
    selected.forEach(function(item, index) {
        $('.' + item).css('background-color', color);
        var pos = item.match(/\d+|[a-zA-Z]+/g);
        var value = table.getRow(pos[0]).getCell(pos[1]).getValue();
        value = parseCell(value);
        value.color = color;
        table.getRow(pos[0]).getCell(pos[1]).setValue(packCell(value));
        $("#" + item).show();
    });
};

var swap = function(obj) {
    if (selected.length != 2) {
        showMessage("Need to select 2 cages.");
        return;
    }
    $.post('data/layout',
            {'op': 'swap', 'op1': selected[0], 'op2': selected[1]},
            function(data, status, jqXHR) {
                if (data == 'ok') {
                    showMessage('Success');
                } else {
                    showMessage(data);
                    return;
                }
        });
    pos1 = selected[0].match(/\d+|[a-zA-Z]+/g);
    pos2 = selected[1].match(/\d+|[a-zA-Z]+/g);
    cell1 = table.getRow(pos1[0]).getCell(pos1[1]);
    cell2 = table.getRow(pos2[0]).getCell(pos2[1]);
    value1 = cell1.getValue();
    value2 = cell2.getValue();
    cell1.setValue(value2);
    cell2.setValue(value1);
    tag1 = parseCell(value1);
    tag2 = parseCell(value2);
    count1 = tag1.tag.length;
    count2 = tag2.tag.length;
    if (count1 > count2) {
        table.getRow(pos2[0]).reformat();
    }
    if (count2 > count1) {
        table.getRow(pos1[0]).reformat();
    }
    
    deselect();
};

var deselect = function(obj) {
    $('.selected').hide();
    selected = [];
    $("#swap_btn").hide();
    $("#cross_btn").hide();
};

var cross = function(obj) {
    if (selected.length != 2) {
        showMessage("Need to select 2 cages.");
        return;
    }
    $.post('data/layout',
            {'op': 'move', 'op1': selected[0], 'op2': selected[1]},
            function(data, status, jqXHR) {
                if (data == 'ok') {
                    showMessage('Success');
                } else {
                    showMessage(data);
                    return;
                }
        });
    var pos1, pos2, cell1, cell2, value1, value2;
    pos1 = selected[0].match(/\d+|[a-zA-Z]+/g);
    pos2 = selected[1].match(/\d+|[a-zA-Z]+/g);
    cell1 = table.getRow(pos1[0]).getCell(pos1[1]);
    cell2 = table.getRow(pos2[0]).getCell(pos2[1]);
    value1 = parseCell(cell1.getValue());
    value2 = parseCell(cell2.getValue());
    cell1.setValue('');
    cell2.setValue(packCell({tag:value1.tag.concat(value2.tag), color:value2.color}));
    table.getRow(pos2[0]).reformat();
    deselect();
};

var make_table = function(data){
    column_definition = [];
    columns.forEach(function(value, index){
        column_definition[index] = {title:value, field:value,
            headerSort:false, variableHeight:true, formatter:cellFormatter};
    });

    table = new Tabulator("#main-table", {
        height: '80%', // set height of table (in CSS or here), this enables the Virtual DOM and improves render speed dramatically (can be any valid css height value)
        data:data, //assign data to table
        //reactiveData:true,
        layout:"fitColumns", //fit columns to width of table (optional)
        columns:column_definition, 
        resizableColumns:false,
        rowFormatter:expandRow,
        cellClick:function(e, cell){ //toggle shadows
            cell_id = cell.getData().id + cell.getField();
            if (cell_id == open_pos){
                return;
            }
            cell_element = $("#" + cell_id);
            if (cell_element.is(":visible")) {
                cell_element.hide();
                selected = selected.filter(function(value, index, arr) {return value != cell_id});
            }
            else {
                cell_element.show();
                selected.push(cell_id);
            }
            if (selected.length == 2){
                $("#swap_btn").show();
                $("#cross_btn").show();
            } else {
                $("#swap_btn").hide();
                $("#cross_btn").hide();
            }
            console.log(selected);
        },

        cellDblClick:function(e, cell){
            deselect();
            cell_id = cell.getData().id + cell.getField();
            $("#holder-div").remove();
            if (cell_id != open_pos) {
                open_pos = cell_id;
                cell.getRow().reformat();
            } else {
                open_pos = '';
            }
        },
    });
};

$.ajax({
    url: '/data/layout',
    data: {'part': 'column'},
    crossDomain:true,
    success: function(data, status, jqXHR) {
        columns = data;
    },
}).done(function(){
    $.ajax({
        url: '/data/layout',
        data: {'part': 'table'},
        crossDomain:true,
        success: function(data, status, jqXHR) {
            tabledata = data;
            make_table(tabledata);
        },
    });
})

$(document).ready(function(){
    $('[data-toggle="tooltip"]').tooltip();
  });

$(document).click(function(event) { 
$target = $(event.target);
if(!$target.closest('#main-table').length && 
!$target.closest('#toolbar').length) {
    deselect();
}        
});