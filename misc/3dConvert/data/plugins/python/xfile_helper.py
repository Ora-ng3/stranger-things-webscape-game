#orig script:
#https://github.com/oguna/Blender-XFileImporter/blob/master/xfile_parser.py

class Face:
    """
    Helper structure representing a XFile mesh face
    """
    def __init__(self):
        self.indices = []


class TexEntry:
    """
    Helper structure representing a texture filename inside a material and its potential source
    """
    def __init__(self, name = '', isNormalMap = False):
        self.name = name
        self.isNormalMap = isNormalMap


class Material:
    """
    Helper structure representing a XFile material
    """
    def __init__(self):
        self.name = ''
        self.isReference = False
        self.diffuse = (1.0, 1.0, 1.0, 1.0)
        self.specularExponent = 0.0
        self.specular = (0.0, 0.0, 0.0)
        self.emissive = (0.0, 0.0, 0.0)
        self.textures = []
        self.sceneIndex = -1


class BoneWeight:
    """
    Helper structure to represent a bone weight
    """
    def __init__(self):
        self.vertex = 0
        self.weight = 0.0


class Bone:
    """
    Helper structure to represent a bone in a mesh
    """
    def __init__(self):
        self.name = ''
        self.weights = []
        self.offsetMatrix = ()


class Mesh:
    """
    Helper structure to represent an XFile mesh
    """
    def __init__(self):
        self.positions = []
        self.posFaces = []
        self.normals = []
        self.normalFaces = []
        self.numTextures = 0
        self.texCoords = [[], []]
        self.numColorSets = 0
        self.colors = [[]]
        self.numMaterials = 0
        self.faceMaterials = []
        self.materials = []
        self.bones = []


class Node:
    """
    Helper structure to represent a XFile frame
    """
    def __init__(self, parent = None):
        self.name = ''
        self.trafoMatrix = ()
        self.parent = parent
        self.children = []
        self.meshes = []


class MatrixKey(object):
    def __init__(self):
        self.time = 0.0
        self.matrix = ()


class AnimBone(object):
    """
    Helper structure representing a single animated bone in a XFile
    """
    def __init__(self):
        self.boneName = ''
        self.posKeys = []
        self.rotKeys = []
        self.scaleKeys = []
        self.trafoKeys = []


class Animation(object):
    """
    Helper structure to represent an animation set in a XFile
    """
    def __init__(self):
        self.name = ''
        self.anims = []


class Scene(object):
    """
    Helper structure analogue to aiScene
    """
    def __init__(self):
        self.rootNode = None
        self.globalMeshes = []
        self.globalMaterials = []
        self.anims = []
        self.animTicksPerSecond = 0


AI_MAX_NUMBER_OF_TEXTURECOORDS = 2
AI_MAX_NUMBER_OF_COLOR_SETS = 1
