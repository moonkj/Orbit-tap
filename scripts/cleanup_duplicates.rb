#!/usr/bin/env ruby
require 'xcodeproj'

project_path = File.join(__dir__, '..', 'ios', 'Runner.xcodeproj')
project = Xcodeproj::Project.open(project_path)

ext_target = project.targets.find { |t| t.name == 'SwiftSafariExtension' }
runner_target = project.targets.find { |t| t.name == 'Runner' }

# Clean extension Sources phase - remove ALL, then add back once
ext_target.source_build_phase.files.each { |f| ext_target.source_build_phase.remove_build_file(f) }
ext_target.resources_build_phase.files.each { |f| ext_target.resources_build_phase.remove_build_file(f) }

# Also clean the Runner target's AppGroupConstants duplicates from the manually added ones
# Keep only the AABB0014 one
runner_sources = runner_target.source_build_phase
to_remove = runner_sources.files.select { |f|
  ref = f.file_ref
  next false unless ref
  name = ref.display_name rescue nil
  next false unless name
  (name == 'AppGroupConstants.swift' && f.uuid != 'AABB0014AABB0014AABB0014') ||
  name == 'SafariWebExtensionHandler.swift'
}
to_remove.each { |f| runner_sources.remove_build_file(f) }

# Find file references for the extension
handler_refs = project.objects.select { |o|
  o.is_a?(Xcodeproj::Project::Object::PBXFileReference) &&
  o.display_name == 'SafariWebExtensionHandler.swift'
}

# Remove duplicate file references, keep the first
handler_ref = handler_refs.first
handler_refs[1..].each { |r| r.remove_from_project } if handler_refs.size > 1

# Find the AppGroupConstants ref (the AABB one)
agc_ref = project.objects.find { |o|
  o.is_a?(Xcodeproj::Project::Object::PBXFileReference) &&
  o.uuid == 'AABB0004AABB0004AABB0004'
}

# Find Resources folder ref
resources_ref = project.objects.find { |o|
  o.is_a?(Xcodeproj::Project::Object::PBXFileReference) &&
  o.display_name == 'Resources' &&
  o.path&.include?('Resources')
}

# Add sources back to extension (once each)
ext_target.source_build_phase.add_file_reference(handler_ref) if handler_ref
ext_target.source_build_phase.add_file_reference(agc_ref) if agc_ref

# Add resources back (once)
ext_target.resources_build_phase.add_file_reference(resources_ref) if resources_ref

project.save
puts "Duplicates cleaned up."
puts "Extension Sources: #{ext_target.source_build_phase.files.map { |f| f.file_ref&.display_name }.compact}"
puts "Extension Resources: #{ext_target.resources_build_phase.files.map { |f| f.file_ref&.display_name }.compact}"
puts "Runner Sources count: #{runner_target.source_build_phase.files.count}"
