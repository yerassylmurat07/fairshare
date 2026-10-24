"""Generate the reviewable OpenAPI document from explicit contract definitions."""
from pathlib import Path
import yaml

S = {'type': 'string'}
ID = {'type': 'string', 'format': 'uuid'}
DATE = {'type': 'string', 'format': 'date'}
TIME = {'type': 'string', 'format': 'date-time'}
NULL_ID = {'type': ['string', 'null'], 'format': 'uuid'}
def ref(name): return {'$ref': '#/components/schemas/' + name}
def array(item): return {'type': 'array', 'items': item}
def obj(properties, required=None):
    return {'type': 'object', 'properties': properties, 'required': list(properties) if required is None else required}

schemas = {
 'Error': obj({'error': S}), 'Ok': obj({'ok': {'type': 'boolean'}}), 'Id': obj({'id': ID}),
 'User': obj({'id': ID, 'name': S, 'email': {'type':'string','format':'email'}, 'initials':S, 'color':S, 'skills':array(S)}),
 'Project': obj({'id':ID, 'teamId':ID, 'name':S, 'course':S, 'teamName':S}),
 'Milestone': obj({'id':ID, 'projectId':ID, 'title':S, 'dueDate':DATE, 'weekStart':DATE, 'revision':{'type':'integer','minimum':1}}),
 'Member': {'allOf':[ref('User'), obj({'role':{'enum':['leader','member']}, 'capacity':{'type':'number'}, 'load':{'type':'number'}})]},
 'TaskInput': obj({'title':{'type':'string','minLength':3,'maxLength':120}, 'goal':{'type':'string','minLength':3,'maxLength':800}, 'firstStep':{'type':'string','minLength':3,'maxLength':800}, 'deliverable':{'type':'string','minLength':3,'maxLength':800}, 'estimate':{'type':'number','exclusiveMinimum':0,'maximum':100,'multipleOf':0.25}, 'skill':{'description':'Skill values must be sent exactly as listed.', 'enum':['Any skill','Architecture','Backend','Frontend','Testing','Documentation','Databases']}, 'dependencyId':NULL_ID}, ['title','goal','firstStep','deliverable','estimate','skill']),
 'Assignment':obj({'taskId':ID,'memberId':NULL_ID,'reason':S,'estimate':{'type':'number'}}),
 'Allocation':obj({'id':ID,'milestoneId':ID,'revision':{'type':'integer'},'status':{'enum':['pending','approved']},'assignments':array(ref('Assignment')),'loads':array(obj({'memberId':ID,'name':S,'capacity':{'type':'number'},'before':{'type':'number'},'after':{'type':'number'}})),'warnings':array(S)}),
 'Resource':obj({'id':ID,'projectId':ID,'authorId':ID,'title':S,'url':{'type':'string','format':'uri'},'author':S,'createdAt':TIME}),
 'Decision':obj({'id':ID,'projectId':ID,'authorId':ID,'title':S,'context':S,'status':{'enum':['open','accepted','declined']},'author':S,'yes':{'type':'integer'},'no':{'type':'integer'},'myVote':{'enum':['yes','no',None]},'createdAt':TIME,'closedAt':{'type':['string','null'],'format':'date-time'}}),
}
schemas['Task']={'allOf':[ref('TaskInput'),obj({'id':ID,'projectId':ID,'milestoneId':ID,'assigneeId':NULL_ID,'status':{'enum':['planned','in_progress','done']},'helpReason':{'type':['string','null']},'evidence':S,'version':{'type':'integer'},'createdAt':TIME})]}
schemas['Workspace']=obj({'user':ref('User'),'projects':array(ref('Project'))})
schemas['ProjectState']=obj({'project':ref('Project'),'milestone':ref('Milestone'),'milestones':array(ref('Milestone')),'members':array(ref('Member')),'tasks':array(ref('Task')),'role':{'enum':['leader','member']}})
patch = dict(schemas['TaskInput']['properties'])
patch.update({'version':{'type':'integer','minimum':1},'status':{'enum':['planned','in_progress','done']},'assigneeId':NULL_ID,'helpReason':{'type':['string','null'],'minLength':3,'maxLength':400},'evidence':{'type':'string','maxLength':1200},'override':{'type':'boolean','default':False}})
schemas['TaskPatch']=obj(patch,['version'])
schemas['TaskCreate']={'allOf':[ref('TaskInput'),obj({'milestoneId':ID})]}
credentials={'email':{'type':'string','format':'email','maxLength':200},'password':{'type':'string','minLength':1,'maxLength':128}}
schemas['Login']=obj(credentials)
schemas['ChangePassword']=obj({'currentPassword':credentials['password'],'newPassword':{'type':'string','minLength':15,'maxLength':128},'confirmPassword':credentials['password']})
schemas['ChangePassword']['description']='Requires an active session and the current password. The new password must differ and match confirmPassword. Revokes all existing sessions, then issues a fresh session to the current browser. Shared demo accounts cannot change their password while demo mode is enabled.'
schemas['Register']=obj({**credentials,'password':{'type':'string','minLength':15,'maxLength':128},'name':{'type':'string','minLength':2,'maxLength':80},'teamName':{'type':'string','minLength':2,'maxLength':80},'inviteToken':{'type':'string','minLength':30,'maxLength':100}},['email','password','name'])
schemas['Register']['anyOf']=[{'required':['teamName']},{'required':['inviteToken']}]
schemas['Register']['description']='Create a team, or join an existing team atomically with inviteToken. Names/email are trimmed; email is lowercased. Passwords are never trimmed.'
schemas['Error']['properties']['fieldErrors']={'type':'object','additionalProperties':S,'description':'Authentication validation errors keyed by field name.'}
schemas['Discussion']=obj({'comments':array(obj({'id':ID,'taskId':ID,'authorId':ID,'name':S,'initials':S,'color':S,'body':S,'createdAt':TIME})),'checklist':array(obj({'id':ID,'taskId':ID,'title':S,'done':{'type':'boolean'},'createdAt':TIME}))})
paths = {}
def operation(path, method, summary, tag, response='Ok', body=None, public=False, description='', query=None):
    result={'summary':summary,'tags':[tag],'operationId':method+'_'+path.strip('/').replace('/','_').replace('{','').replace('}',''), 'responses':{'200':{'description':'Success','content':{'application/json':{'schema':ref(response) if isinstance(response,str) else response}}}}}
    for status, desc in [('400','Invalid input'),('401','Session missing or expired'),('403','Insufficient permissions'),('404','Object unavailable'),('409','Version or state conflict'),('410','Invitation invalid'),('429','Rate limit exceeded'),('500','Internal error')]:
        result['responses'][status]={'description':desc,'content':{'application/json':{'schema':ref('Error')}}}
    if public: result['security']=[]
    if description:result['description']=description
    params=[]
    import re
    for name in re.findall(r'\{(\w+)\}',path):params.append({'name':name,'in':'path','required':True,'schema':ID})
    for name,schema,required in query or []:params.append({'name':name,'in':'query','required':required,'schema':schema})
    if params:result['parameters']=params
    if body:result['requestBody']={'required':True,'content':{'application/json':{'schema':ref(body) if isinstance(body,str) else body}}}
    paths.setdefault(path,{})[method]=result

operation('/health','get','Check database availability','System',public=True)
operation('/config','get','Get demo mode availability','System',obj({'demoEnabled':{'type':'boolean'}}),public=True)
operation('/auth/session','get','Get the current session; guests receive a null user','Identity',obj({'user':{'anyOf':[ref('User'),{'type':'null'}]}}),public=True)
operation('/auth/register','post','Create an account and create or join a team','Identity',obj({'user':ref('User')}),'Register',True)
operation('/auth/login','post','Sign in','Identity',obj({'user':ref('User')}),'Login',True)
operation('/auth/password','post','Change own password and revoke other sessions','Identity',body='ChangePassword')
operation('/auth/logout','post','Delete the current session','Identity',public=True)
operation('/auth/demo','post','Sign in to the educational demo team','Identity',obj({'user':ref('User')}),public=True,description='This route is absent when demo mode is disabled.')
operation('/workspace','get','Get the account and accessible projects','Workspace','Workspace')
operation('/me/tasks','get','Get personal tasks across accessible projects','Tasks',array({'allOf':[ref('Task'),obj({'projectName':S,'milestoneTitle':S})]}))
operation('/me/availability','put','Update personal weekly hours and skills','Workspace',body=obj({'weekStart':DATE,'hours':{'type':'number','minimum':0,'maximum':100,'multipleOf':.25},'skills':array(schemas['TaskInput']['properties']['skill'])}),description='weekStart is Monday UTC; hours is total availability across all projects, rather than a separate budget for one team.')
operation('/projects','post','Create a project in your team','Projects','Id',obj({'teamId':ID,'name':{'type':'string','minLength':2,'maxLength':100},'course':{'type':'string','maxLength':60}},['teamId','name']))
operation('/projects/{id}/state','get','Get a milestone, its tasks, and weekly workload','Projects','ProjectState',query=[('milestoneId',ID,False)])
operation('/projects/{id}/milestones','post','Create a weekly milestone','Projects','Id',obj({'title':{'type':'string','minLength':2,'maxLength':100},'weekStart':DATE,'dueDate':DATE}),description='Coordinator only; dueDate must fall within the selected week.')
operation('/projects/{id}/tasks','post','Create a task with clear context','Tasks','Id','TaskCreate')
operation('/projects/{id}/tasks/{taskId}','patch','Update a task with version validation','Tasks',body='TaskPatch',description='Members may change only the status, help request, and evidence of their own assigned task. Requirements and assignments are coordinator-only. override is required for manual skill or capacity exceptions. A dependency omitted from PATCH is preserved.')
operation('/projects/{id}/tasks/{taskId}','delete','Delete a planned task','Tasks',query=[('version',{'type':'integer','minimum':1},True)],description='Coordinator only; prohibited if other tasks depend on this task.')
operation('/projects/{id}/allocations','post','Build an allocation proposal','Allocation','Allocation',obj({'milestoneId':ID}),description='Coordinator only; actual assignments remain unchanged.')
operation('/projects/{id}/allocations/{allocationId}/approve','post','Approve a proposal atomically','Allocation','Allocation',description='Returns 409 if the snapshot has changed; reapproving an approved proposal is idempotent.')
operation('/projects/{id}/invitations','post','Create a single-use invitation','Workspace',obj({'token':S,'expiresInHours':{'type':'integer'}}),description='Coordinator only; valid for 24 hours. The raw token is returned only at creation.')
operation('/invitations/accept','post','Accept an invitation','Workspace',body=obj({'token':{'type':'string','minLength':30,'maxLength':100}}))
operation('/projects/{id}/events','get','Get the latest 50 project events','Collaboration',array(obj({'kind':S,'details':{'type':'object'},'created_at':TIME,'actor':S})))
operation('/projects/{id}/tasks/{taskId}/discussion','get','Get task discussion and checklist steps','Collaboration','Discussion')
operation('/projects/{id}/tasks/{taskId}/comments','post','Add a comment','Collaboration',body=obj({'body':{'type':'string','minLength':1,'maxLength':2000}}))
operation('/projects/{id}/tasks/{taskId}/checklist','post','Add a concrete checklist step','Collaboration',body=obj({'title':{'type':'string','minLength':2,'maxLength':160}}))
operation('/projects/{id}/tasks/{taskId}/checklist/{itemId}','patch','Update a checklist step state','Collaboration',body=obj({'done':{'type':'boolean'}}))
operation('/projects/{id}/collaboration','get','Get project resources and decisions','Collaboration',obj({'resources':array(ref('Resource')),'decisions':array(ref('Decision'))}))
operation('/projects/{id}/resources','post','Add an external resource','Collaboration',body=obj({'title':{'type':'string','minLength':2,'maxLength':100},'url':{'type':'string','format':'uri','maxLength':1000}}),description='HTTP/HTTPS only; the server does not fetch the URL content.')
operation('/projects/{id}/decisions','post','Propose a team decision','Collaboration',body=obj({'title':{'type':'string','minLength':3,'maxLength':120},'context':{'type':'string','minLength':1,'maxLength':2000}}))
operation('/projects/{id}/decisions/{decisionId}/vote','post','Cast or replace your vote','Collaboration',body=obj({'choice':{'enum':['yes','no']}}),description='Voting is allowed only while the decision is open.')
operation('/projects/{id}/decisions/{decisionId}','patch','Record a decision outcome','Collaboration',body=obj({'status':{'enum':['accepted','declined']}}),description='Coordinator only. Record the outcome after discussion; vote counts do not automatically close the decision.')

document={'openapi':'3.1.0','info':{'title':'FairShare MVP API','version':'0.1.0','description':'Working MVP with same-origin cookie sessions; the server checks roles and team membership.'},'servers':[{'url':'http://localhost:3000/api'}],'security':[{'sessionCookie':[]}],'paths':paths,'components':{'securitySchemes':{'sessionCookie':{'type':'apiKey','in':'cookie','name':'fairshare_session'}},'schemas':schemas}}
target=Path(__file__).parents[1]/'contracts/openapi.yaml'
target.write_text(yaml.safe_dump(document,allow_unicode=True,sort_keys=False),encoding='utf-8')
print(f'Wrote {len(paths)} paths / {sum(len(p) for p in paths.values())} operations')
