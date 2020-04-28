import tornado.ioloop
import tornado.web
import tornado.escape
from tornado.web import Finish
from datetime import datetime
import json
import pandas as pd
import numpy as np
import re
import asyncio
import os
import webbrowser

# Port
HTTP_PORT = 10080

def static_vars(**kwargs):
    def decorate(func):
        for k in kwargs:
            setattr(func, k, kwargs[k])
        return func
    return decorate

@static_vars(num = re.compile('^[0-9]+'),
    letter = re.compile('[A-Z]+'))
def get_position(pos):
    row = get_position.num.findall(pos)[0]
    column = get_position.letter.findall(pos)[0]
    return row, column

def frame_to_layout_cell(df):
    tags = []
    color = ''
    if len(df) > 0:
        tags = list(df['tag'].astype(str))
        color = df.iloc[0]['color']
        if pd.isna(color):
            color = ''
        else:
            color = str(color)

    return make_layout_cell(tags, color)

def merge_layout_cell(cell1, cell2):
    tag1, color1 = parse_layout_cell(cell1)
    tag2, _color2 = parse_layout_cell(cell2)
    return make_layout_cell(tag1 + tag2, color1)

def parse_layout_cell(cell):
    # tags = cell.split('|')
    # color = ''
    # if len(tags) > 1:
    #     color = tags[1]
    # tags = tags[0].split(' ')
    # return tags, color
    return cell.tag, cell.color

def make_layout_cell(tags, color):
    #return ' '.join(tags) + '|' + color
    return {'tag':tags, 'color':color}

class DataHolder:
    def __init__(self, animal_list_file, animal_proc_file, animal_breed_file):
        self.animal_list_file = animal_list_file
        self.animal_proc_file = animal_proc_file
        self.animal_breed_file = animal_breed_file
        self.animal_list = pd.read_csv(animal_list_file)
        self.animal_list['id'] = self.animal_list['id'].astype(int)
        self.layout = list_to_table(self.animal_list)
        self.animal_proc = pd.read_csv(animal_proc_file)
        self.animal_breed = pd.read_csv(animal_breed_file)
        self.layout_columns = list(self.layout.columns)
        self.layout_columns.remove('id')

    def swap(self, pos1, pos2):
        live_filter = pd.isna(self.animal_list['death'])
        p1_filter = self.animal_list['loc'] == pos1
        p2_filter = self.animal_list['loc'] == pos2
        self.animal_list.loc[np.logical_and(live_filter, p1_filter), 'loc'] = pos2
        self.animal_list.loc[np.logical_and(live_filter, p2_filter), 'loc'] = pos1
        row1, col1 = get_position(pos1)
        row2, col2 = get_position(pos2)
        (self.layout.loc[row1, col1], 
            self.layout.loc[row2, col2]) = (self.layout.loc[row2, col2], 
                self.layout.loc[row1, col1])

    def merge(self, pos1, pos2):
        live_filter = pd.isna(self.animal_list['death'])
        p1_filter = np.logical_and(self.animal_list['loc'] == pos1, live_filter)
        p2_filter = np.logical_and(self.animal_list['loc'] == pos2, live_filter)
        self.animal_list.loc[p1_filter, 'loc'] = pos2

        row1, col1 = get_position(pos1)
        row2, col2 = get_position(pos2)
        self.layout.loc[row2, col2] = merge_layout_cell(self.layout.loc[row2, col2],
            self.layout.loc[row1, col1])
        self.layout.loc[row1, col1] = ''
        
        group1 = self.animal_list.loc[p1_filter]
        group2 = self.animal_list.loc[p2_filter]
        self.check_add_mating(group1, group2)

    def check_add_mating(self, group1, group2):
        for _idx1, row1 in group1.iterrows():
            for _idx2, row2 in group2.iterrows():
                if row1['sex'] != row2['sex']:
                    self.add_mating(row1, row2)

    def add_mating(self, animal1, animal2):
        if animal1['sex'] == 'F' and animal2['sex'] == 'M':
            animal1, animal2 = animal2, animal1
        mating = {'male_tag':animal1['tag'], 'female_tag':animal2['tag'], 
        'male_genotype':animal1['genotype'], 'female_genotype':animal2['genotype'],
        'date':datetime.today().strftime('%Y-%m-%d'),
        'birth':None, 'littersize':None, 'loc':animal1['loc']}
        self.animal_breed = self.animal_breed.append(mating, ignore_index=True)

    def add_proc(self, animal, proc):
        record = {'tag':animal['tag'], 'genotype':animal['genotype'],
        'sex':animal['sex'], 'date':datetime.today().strftime('%Y-%m-%d'),
        'proc':proc}
        self.animal_proc = self.animal_proc.append(record, ignore_index=True)

    def add_animal(self, animal):
        old_group = self.animal_list[self.animal_list['loc'] == animal['loc']]
        if animal['id'] in self.animal_list['id']:
            animal['id'] = max(self.animal_list['id']) + 1
        self.animal_list.append(animal, ignore_index=True)
        row, col = get_position(animal['loc'])
        self.layout.loc[row, col] = animal['tag'] + ' ' + self.layout.loc[row, col]
        for _idx, row, in old_group.iterrows():
            if row['sex'] != animal['sex']:
                self.add_mating(row, animal)

    def set_color(self, color, pos_list):
        for pos in pos_list:
            row, col = get_position(pos)
            tags, color = parse_layout_cell(self.layout.loc[row, col])
            self.layout.loc[row, col] = make_layout_cell(tags, color)
            self.animal_list.loc[self.animal_list['loc'] == pos, 'color'] = color

    def save(self):
        self.animal_breed.to_csv(self.animal_breed_file)
        self.animal_proc.to_csv(self.animal_proc_file)
        self.animal_list.to_csv(self.animal_list_file)

    def get_layout_columns(self):
        return self.layout_columns

    def get_layout(self):
        return self.layout

    def get_list(self):
        return self.animal_list

    def get_cage(self, loc):
        live_filter = pd.isna(self.animal_list['death'])
        p1_filter = np.logical_and(self.animal_list['loc'] == loc, live_filter)
        return self.animal_list[p1_filter]

    def update(self, loc, data):
        print (data)
        df = pd.read_json(data, orient='records')
        df = df[pd.notna(df['sex'])]
        df['id'] = df['id'].astype(int)
        df['tag'] = df['tag'].astype(str)
        cols = df.columns.intersection(self.animal_list.columns)
        df = df.loc[:, cols]

        # Process dead animals
        dead_df = df[pd.notna(df['death'])]
        df = df[pd.isna(df['death'])]  #alive
        self.animal_list = self.animal_list.set_index('id')
        dead_df = dead_df.set_index('id')
        self.animal_list.loc[dead_df.index] = dead_df
        row, col = get_position(loc)
        left_df = self.animal_list[self.animal_list['loc'] == loc]
        left_df = left_df[pd.isna(left_df['death'])]
        self.layout.loc[row, col] = frame_to_layout_cell(left_df)


        # Process updated animals
        layout = list_to_table(df)
        for idx in layout.index:
            for col in layout.columns:
                if col != 'id':
                    self.layout.loc[idx, col] = layout.loc[idx, col]
        update_part = df[df['id'] > 0]
        update_part = update_part.set_index('id')
        self.animal_list.loc[update_part.index] = update_part
        self.animal_list = self.animal_list.reset_index()

        # Process newly added animals
        old_group = self.animal_list[self.animal_list['loc'] == loc]
        df = df[df['id'] < 0]
        if len(df) > 0:
            df['id'] = max(self.animal_list['id']) - df['id']
            self.animal_list = self.animal_list.append(df, ignore_index=True)
            self.check_add_mating(old_group, df)
    
    def transfer(self, destination, animals):
        df = pd.read_json(animals, orient='records')
        df['id'] = df['id'].astype(int)
        df['tag'] = df['tag'].astype(str)
        cages = set(df['loc']).union(set([destination]))
        df = df.set_index('id')
        self.animal_list = self.animal_list.set_index('id')
        self.animal_list.loc[df.index, 'loc'] = destination
        self.animal_list = self.animal_list.reset_index()
        affected = self.animal_list[self.animal_list['loc'].isin(cages)]
        self.layout = list_to_table(self.animal_list)
        rebuilt_layout = list_to_table(affected)
        print (cages, rebuilt_layout)
        #for row in rebuilt_layout.index:
        #    for col in rebuilt_layout.columns:
        #        self.layout.loc[row, col] = rebuilt_layout.loc[row, col]


class BaseHandler(tornado.web.RequestHandler):

    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Content-Type", "application/json; charset=UTF-8")

    def write_error(self, status_code, **kwargs):
        data = {}
        for key, value in kwargs.items():
            data[key] = value
        try:
            del data['exc_info']
        except:
            pass

        self.write(json.dumps(data))
        self.set_status(status_code)
        raise Finish()

class HomeHandler(tornado.web.RequestHandler):
    def get(self, *args, **kwargs):
        self.render('index.html')

class ListTableHandler(BaseHandler):
    def initialize(self, data):
        self._data = data

    def get(self):
        self.write(self._data.get_list().to_json(orient='records'))

class LayoutTableHandler(BaseHandler):
    def initialize(self, data):
        self._data = data

    def get(self):
        part = self.get_argument('part', default=None)
        if part == 'column':
            self.write(json.dumps(self._data.get_layout_columns()))
        elif part == 'cage':
            cage = self.get_argument('cage', default=None)
            if cage is not None:
                cage = cage.upper()
                self.write(self._data.get_cage(cage).to_json(orient='records'))
        else:
            self.write(self._data.get_layout().to_json(orient='records'))
    
    def post(self):
        operation = self.get_argument('op', default=None)
        op1 = self.get_argument('op1', default=None)
        op2 = self.get_argument('op2', default=None)
        
        print ("post")
        print (operation, op1, op2)
        
        if operation is None:
            return
        self.set_header("Content-Type", "text/plain")
        if op1 is None or op2 is None:
            self.write('Unable to finish operation.')
            return
        if operation == 'swap':
            self._data.swap(op1, op2)
        elif operation == 'move':
            self._data.merge(op1, op2)
        elif operation == 'color':
            op2 = json.loads(op2)
            self._data.set_color(op1, op2)
        elif operation == 'update':
            self._data.update(op1, op2)
        elif operation == 'transfer':
            self._data.transfer(op1, op2)
        self._data.save()
        self.write('ok')
        

if os.name == 'nt':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

def list_to_table(df):
    live_group = df[pd.isna(df['death'])]
    result = pd.DataFrame()
    if len(live_group) > 0:
        live_group = live_group.groupby('loc')
    else:
        return result
    
    for name, group in live_group:
        row, column = get_position(name)
        tags = frame_to_layout_cell(group)
        record = {'id':row, 'field':column, 'tags': tags}
        result = result.append(record, ignore_index=True)
    result = result.pivot(index='id', columns='field', values='tags')
    result['id'] = result.index
    result[pd.isna(result)] = ''
    return result

if __name__ == "__main__":

    print ("Starting Sinch demo backend on port: \033[1m" + str(HTTP_PORT) +'\033[0m')
    print ("--- LOG ---")

    data_holder = DataHolder('list.csv', 'proc.csv', 'breed.csv')

    settings = {
    "static_path": os.path.dirname(__file__),
    }
    backend = tornado.web.Application([
    (r"/", HomeHandler),
    (r"/data/layout", LayoutTableHandler, dict(data=data_holder)),
    (r"/data/list", ListTableHandler, dict(data=data_holder)),
    #(r"/([a-zA-Z0-9]+\.(html|htm|css|js))", HomeHandler),
    (r"/([a-zA-Z0-9]+\.(html|htm|css|js))", tornado.web.StaticFileHandler, dict(path=settings['static_path'])),
    ])
    backend.listen(HTTP_PORT)
    webbrowser.open('http://localhost:10080/', new=2)
    tornado.ioloop.IOLoop.instance().start()
